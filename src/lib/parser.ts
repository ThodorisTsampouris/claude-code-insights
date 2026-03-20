import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { calculateCost, getModelDisplayName, type TokenUsage } from "./pricing";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  type: "user" | "assistant" | "system" | "progress" | "file-history-snapshot";
  subtype?: string;
  timestamp: string;
  model?: string;
  content?: string;
  toolUse?: {
    name: string;
    input: Record<string, unknown>;
  };
  usage?: TokenUsage;
  cost?: number;
  stopReason?: string;
  isSidechain?: boolean;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
}

export interface AgentInfo {
  id: string;
  parentSessionId: string;
  description?: string;
  status: "running" | "completed" | "unknown";
  messages: ParsedMessage[];
  totalCost: number;
  totalTokens: TokenUsage;
  startTime?: string;
  lastActivity?: string;
  model?: string;
}

export interface FileActivity {
  path: string;
  shortPath: string;
  reads: number;
  edits: number;
  writes: number;
  total: number;
}

export interface CostPerTurn {
  turnIndex: number;
  userTimestamp: string;
  userContent: string;
  cost: number;
  tokens: number;
  assistantMessages: number;
  toolCalls: string[];
}

export interface TimelineEvent {
  timestamp: string;
  type: "user" | "assistant" | "tool" | "agent";
  toolName?: string;
  model?: string;
  cost?: number;
}

export interface CompactionEvent {
  timestamp: string;
  trigger: string;
  preTokens: number;
  turnIndex: number; // which turn it happened after
}

export interface ContextSnapshot {
  timestamp: string;
  inputTokens: number; // context size at this point
}


export interface SessionSummary {
  sessionId: string;
  projectPath: string;
  projectName: string;
  projectRoot: string | null;
  startTime: string;
  lastActivity: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  modelBreakdown: Record<string, { count: number; cost: number; tokens: TokenUsage }>;
  toolUsage: Record<string, number>;
  messages: ParsedMessage[];
  agents: AgentInfo[];
  costOverTime: { timestamp: string; cumulativeCost: number; model: string }[];
  fileActivity: FileActivity[];
  costPerTurn: CostPerTurn[];
  timeline: TimelineEvent[];
  compactions: CompactionEvent[];
  contextSnapshots: ContextSnapshot[];
  contextLimit: number; // model's max context window
}

export interface ProjectInfo {
  path: string;
  name: string;
  root: string | null;
  sessions: { id: string; file: string; modifiedAt: Date; size: number }[];
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseLogLine(line: string): ParsedMessage | null {
  try {
    const raw = JSON.parse(line);

    // Skip non-message types
    if (raw.type === "file-history-snapshot") return null;

    const msg: ParsedMessage = {
      uuid: raw.uuid || "",
      parentUuid: raw.parentUuid || null,
      sessionId: raw.sessionId || "",
      type: raw.type || "system",
      timestamp: raw.timestamp || "",
      isSidechain: raw.isSidechain || false,
    };

    if (raw.message) {
      msg.model = raw.message.model;
      msg.stopReason = raw.message.stop_reason;

      // Extract usage
      if (raw.message.usage) {
        const u = raw.message.usage;
        msg.usage = {
          inputTokens: u.input_tokens || 0,
          outputTokens: u.output_tokens || 0,
          cacheCreationTokens: u.cache_creation_input_tokens || 0,
          cacheReadTokens: u.cache_read_input_tokens || 0,
        };
        if (msg.model) {
          // Use detailed cache breakdown if available
          const cacheDetail = u.cache_creation;
          const detailed = cacheDetail ? {
            cacheWrite5m: cacheDetail.ephemeral_5m_input_tokens || 0,
            cacheWrite1h: cacheDetail.ephemeral_1h_input_tokens || 0,
          } : undefined;
          msg.cost = calculateCost(msg.model, msg.usage, detailed);
        }
      }

      // Extract content/tool use
      if (Array.isArray(raw.message.content)) {
        for (const block of raw.message.content) {
          if (block.type === "text") {
            msg.content = block.text;
          } else if (block.type === "tool_use") {
            msg.toolUse = {
              name: block.name,
              input: block.input || {},
            };
          }
        }
      } else if (typeof raw.message.content === "string") {
        msg.content = raw.message.content;
      }
    }

    // System messages with direct content
    if (raw.type === "system" && raw.content) {
      msg.content = raw.content;
      msg.subtype = raw.subtype;
    }

    // Compaction metadata
    if (raw.compactMetadata) {
      msg.compactMetadata = {
        trigger: raw.compactMetadata.trigger || "unknown",
        preTokens: raw.compactMetadata.preTokens || 0,
      };
    }

    return msg;
  } catch {
    return null;
  }
}

function parseJsonlFile(filePath: string): ParsedMessage[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    return lines.map(parseLogLine).filter((m): m is ParsedMessage => m !== null);
  } catch {
    return [];
  }
}

// ─── Agent Parsing ───────────────────────────────────────────────────────────

function parseAgents(sessionDir: string, sessionId: string): AgentInfo[] {
  const subagentsDir = join(sessionDir, "subagents");
  if (!existsSync(subagentsDir)) return [];

  const agents: AgentInfo[] = [];
  try {
    const files = readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const filePath = join(subagentsDir, file);
      const messages = parseJsonlFile(filePath);
      const agentId = basename(file, ".jsonl");

      const totalTokens: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      let totalCost = 0;
      let model: string | undefined;
      let description: string | undefined;

      for (const msg of messages) {
        if (msg.usage) {
          totalTokens.inputTokens += msg.usage.inputTokens;
          totalTokens.outputTokens += msg.usage.outputTokens;
          totalTokens.cacheCreationTokens += msg.usage.cacheCreationTokens;
          totalTokens.cacheReadTokens += msg.usage.cacheReadTokens;
        }
        if (msg.cost) totalCost += msg.cost;
        if (msg.model && !model) model = msg.model;

        // Try to extract agent description from first user message
        if (msg.type === "user" && msg.content && !description) {
          description = msg.content;
        }
      }

      const timestamps = messages
        .map((m) => m.timestamp)
        .filter(Boolean)
        .sort();

      // Determine status based on last message
      const lastMsg = messages[messages.length - 1];
      const hasEndTurn = lastMsg?.stopReason === "end_turn";
      const lastActivityTime = timestamps[timestamps.length - 1];
      const timeSinceLastActivity = lastActivityTime
        ? Date.now() - new Date(lastActivityTime).getTime()
        : Infinity;

      let status: "running" | "completed" | "unknown" = "unknown";
      if (hasEndTurn) {
        status = "completed";
      } else if (timeSinceLastActivity < 120_000) {
        // Active in last 2 minutes
        status = "running";
      } else {
        status = "completed";
      }

      agents.push({
        id: agentId,
        parentSessionId: sessionId,
        description,
        status,
        messages,
        totalCost,
        totalTokens,
        startTime: timestamps[0],
        lastActivity: timestamps[timestamps.length - 1],
        model,
      });
    }
  } catch {
    // subagents dir might not be readable
  }

  return agents;
}

// ─── Session Analysis ────────────────────────────────────────────────────────

function extractFilePath(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Read" || toolName === "Edit" || toolName === "Write") {
    return (input.file_path as string) || null;
  }
  if (toolName === "Glob") {
    return (input.path as string) || (input.pattern as string) || null;
  }
  if (toolName === "Grep") {
    return (input.path as string) || null;
  }
  return null;
}

function shortenPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}

function analyzeSession(
  messages: ParsedMessage[],
  sessionId: string,
  projectPath: string,
  agents: AgentInfo[]
): SessionSummary {
  const totalTokens: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };
  let totalCost = 0;
  const modelBreakdown: SessionSummary["modelBreakdown"] = {};
  const toolUsage: Record<string, number> = {};
  const costOverTime: SessionSummary["costOverTime"] = [];
  let cumulativeCost = 0;

  // File activity tracking
  const fileMap = new Map<string, { reads: number; edits: number; writes: number }>();

  // Timeline events
  const timeline: TimelineEvent[] = [];

  // Cost per turn tracking
  const costPerTurn: CostPerTurn[] = [];
  let currentTurn: CostPerTurn | null = null;
  let turnIndex = 0;

  // Compaction tracking
  const compactions: CompactionEvent[] = [];
  const contextSnapshots: ContextSnapshot[] = [];
  let contextLimit = 200_000; // default for Opus
  let primaryModel = "";

  for (const msg of messages) {
    if (msg.usage) {
      totalTokens.inputTokens += msg.usage.inputTokens;
      totalTokens.outputTokens += msg.usage.outputTokens;
      totalTokens.cacheCreationTokens += msg.usage.cacheCreationTokens;
      totalTokens.cacheReadTokens += msg.usage.cacheReadTokens;
    }

    if (msg.cost != null) {
      totalCost += msg.cost;
      cumulativeCost += msg.cost;
    }

    if (msg.model) {
      const displayName = getModelDisplayName(msg.model);
      if (!modelBreakdown[displayName]) {
        modelBreakdown[displayName] = {
          count: 0,
          cost: 0,
          tokens: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
        };
      }
      modelBreakdown[displayName].count++;
      if (msg.cost) modelBreakdown[displayName].cost += msg.cost;
      if (msg.usage) {
        modelBreakdown[displayName].tokens.inputTokens += msg.usage.inputTokens;
        modelBreakdown[displayName].tokens.outputTokens += msg.usage.outputTokens;
        modelBreakdown[displayName].tokens.cacheCreationTokens += msg.usage.cacheCreationTokens;
        modelBreakdown[displayName].tokens.cacheReadTokens += msg.usage.cacheReadTokens;
      }
    }

    if (msg.toolUse) {
      toolUsage[msg.toolUse.name] = (toolUsage[msg.toolUse.name] || 0) + 1;

      // Track file activity
      const filePath = extractFilePath(msg.toolUse.name, msg.toolUse.input);
      if (filePath) {
        const entry = fileMap.get(filePath) || { reads: 0, edits: 0, writes: 0 };
        if (msg.toolUse.name === "Read" || msg.toolUse.name === "Glob" || msg.toolUse.name === "Grep") {
          entry.reads++;
        } else if (msg.toolUse.name === "Edit") {
          entry.edits++;
        } else if (msg.toolUse.name === "Write") {
          entry.writes++;
        }
        fileMap.set(filePath, entry);
      }
    }

    if (msg.cost != null && msg.timestamp) {
      costOverTime.push({
        timestamp: msg.timestamp,
        cumulativeCost,
        model: msg.model ? getModelDisplayName(msg.model) : "Unknown",
      });
    }

    // Build timeline
    if (msg.timestamp && msg.type === "user" && !msg.isSidechain) {
      timeline.push({ timestamp: msg.timestamp, type: "user" });
    } else if (msg.timestamp && msg.type === "assistant") {
      if (msg.toolUse) {
        timeline.push({
          timestamp: msg.timestamp,
          type: "tool",
          toolName: msg.toolUse.name,
          model: msg.model,
          cost: msg.cost,
        });
      } else {
        timeline.push({
          timestamp: msg.timestamp,
          type: "assistant",
          model: msg.model,
          cost: msg.cost,
        });
      }
    }

    // Track context window size from input tokens
    if (msg.usage && msg.timestamp) {
      const totalInput = msg.usage.inputTokens + msg.usage.cacheCreationTokens + msg.usage.cacheReadTokens;
      if (totalInput > 0) {
        contextSnapshots.push({ timestamp: msg.timestamp, inputTokens: totalInput });
      }
      // Detect model context limit
      if (msg.model && !primaryModel) {
        primaryModel = msg.model;
        if (msg.model.includes("haiku")) contextLimit = 200_000;
        else if (msg.model.includes("sonnet")) contextLimit = 200_000;
        else if (msg.model.includes("opus")) contextLimit = 200_000;
      }
    }

    // Track compaction events
    if (msg.subtype === "compact_boundary" && msg.compactMetadata) {
      compactions.push({
        timestamp: msg.timestamp,
        trigger: msg.compactMetadata.trigger,
        preTokens: msg.compactMetadata.preTokens,
        turnIndex: turnIndex,
      });
    }

    // Build cost per turn
    if (msg.type === "user" && !msg.isSidechain && msg.content && !msg.content.startsWith("<")) {
      // New user turn — save previous turn
      if (currentTurn) {
        costPerTurn.push(currentTurn);
      }
      currentTurn = {
        turnIndex: turnIndex++,
        userTimestamp: msg.timestamp,
        userContent: msg.content,
        cost: 0,
        tokens: 0,
        assistantMessages: 0,
        toolCalls: [],
      };
    } else if (currentTurn && msg.type === "assistant") {
      currentTurn.assistantMessages++;
      if (msg.cost) currentTurn.cost += msg.cost;
      if (msg.usage) {
        currentTurn.tokens += msg.usage.inputTokens + msg.usage.outputTokens;
      }
      if (msg.toolUse) {
        currentTurn.toolCalls.push(msg.toolUse.name);
      }
    }
  }
  // Push last turn
  if (currentTurn) {
    costPerTurn.push(currentTurn);
  }

  // Add agent costs
  for (const agent of agents) {
    totalCost += agent.totalCost;
    totalTokens.inputTokens += agent.totalTokens.inputTokens;
    totalTokens.outputTokens += agent.totalTokens.outputTokens;
    totalTokens.cacheCreationTokens += agent.totalTokens.cacheCreationTokens;
    totalTokens.cacheReadTokens += agent.totalTokens.cacheReadTokens;
  }

  // Convert file map to sorted array
  const fileActivity: FileActivity[] = Array.from(fileMap.entries())
    .map(([path, counts]) => ({
      path,
      shortPath: shortenPath(path),
      reads: counts.reads,
      edits: counts.edits,
      writes: counts.writes,
      total: counts.reads + counts.edits + counts.writes,
    }))
    .sort((a, b) => b.total - a.total);

  const timestamps = messages.map((m) => m.timestamp).filter(Boolean).sort();

  return {
    sessionId,
    projectPath,
    projectName: decodeProjectPath(projectPath),
    projectRoot: decodeProjectRoot(projectPath),
    startTime: timestamps[0] || "",
    lastActivity: timestamps[timestamps.length - 1] || "",
    totalCost,
    totalTokens,
    messageCount: messages.length,
    modelBreakdown,
    toolUsage,
    messages,
    agents,
    costOverTime,
    fileActivity,
    costPerTurn,
    timeline,
    compactions,
    contextSnapshots,
    contextLimit,
  };
}

function decodeProjectPath(encoded: string): string {
  // Project dirs are encoded as -Users-foo-bar -> /Users/foo/bar
  const decoded = encoded.replace(/^-/, "/").replace(/-/g, "/");
  // Return just the last path segment
  const parts = decoded.split("/").filter(Boolean);
  return parts[parts.length - 1] || encoded;
}

/** Decode encoded project path to real filesystem path (handles dashes in folder names). */
function decodeProjectRoot(encoded: string): string | null {
  const naive = encoded.replace(/^-/, "/").replace(/-/g, "/");
  if (existsSync(naive)) return naive;

  // Walk segments and find the longest valid prefix (dashes in names)
  const parts = encoded.replace(/^-/, "").split("-");
  let current = "/";
  let i = 0;

  while (i < parts.length) {
    let found = false;
    for (let j = parts.length; j > i; j--) {
      const candidate = join(current, parts.slice(i, j).join("-"));
      if (existsSync(candidate)) {
        current = candidate;
        i = j;
        found = true;
        break;
      }
    }
    if (!found) {
      current = join(current, parts[i]);
      i++;
    }
  }

  return existsSync(current) ? current : null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getClaudeDir(): string {
  return join(homedir(), ".claude");
}

export function listProjects(): ProjectInfo[] {
  const projectsDir = join(getClaudeDir(), "projects");
  if (!existsSync(projectsDir)) return [];

  const projects: ProjectInfo[] = [];
  try {
    const dirs = readdirSync(projectsDir);
    for (const dir of dirs) {
      const dirPath = join(projectsDir, dir);
      try {
        const stat = statSync(dirPath);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }

      const sessions: ProjectInfo["sessions"] = [];
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
        for (const file of files) {
          const filePath = join(dirPath, file);
          try {
            const stat = statSync(filePath);
            sessions.push({
              id: basename(file, ".jsonl"),
              file: filePath,
              modifiedAt: stat.mtime,
              size: stat.size,
            });
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }

      sessions.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

      if (sessions.length > 0) {
        projects.push({
          path: dir,
          name: decodeProjectPath(dir),
          root: decodeProjectRoot(dir),
          sessions,
        });
      }
    }
  } catch {
    return [];
  }

  // Sort by most recent session
  projects.sort((a, b) => {
    const aTime = a.sessions[0]?.modifiedAt.getTime() || 0;
    const bTime = b.sessions[0]?.modifiedAt.getTime() || 0;
    return bTime - aTime;
  });

  return projects;
}

export interface DailySpending {
  date: string; // YYYY-MM-DD
  cost: number;
  sessions: number;
  tokens: number;
  projectBreakdown: Record<string, number>;
}

export function getAggregateSpending(days: number = 30): DailySpending[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dailyMap = new Map<string, DailySpending>();
  const projects = listProjects();

  for (const project of projects) {
    for (const session of project.sessions) {
      // Skip old sessions based on file modification time
      if (new Date(session.modifiedAt) < cutoff) continue;

      try {
        const content = readFileSync(session.file, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            if (raw.type !== "assistant" || !raw.message?.usage || !raw.message?.model) continue;

            const ts = raw.timestamp;
            if (!ts) continue;

            const date = new Date(ts).toISOString().slice(0, 10);
            if (new Date(ts) < cutoff) continue;

            const u = raw.message.usage;
            const usage: TokenUsage = {
              inputTokens: u.input_tokens || 0,
              outputTokens: u.output_tokens || 0,
              cacheCreationTokens: u.cache_creation_input_tokens || 0,
              cacheReadTokens: u.cache_read_input_tokens || 0,
            };
            const cacheDetail = u.cache_creation;
            const detailed = cacheDetail ? {
              cacheWrite5m: cacheDetail.ephemeral_5m_input_tokens || 0,
              cacheWrite1h: cacheDetail.ephemeral_1h_input_tokens || 0,
            } : undefined;
            const cost = calculateCost(raw.message.model, usage, detailed);
            const tokens = usage.inputTokens + usage.outputTokens;

            const entry = dailyMap.get(date) || {
              date,
              cost: 0,
              sessions: 0,
              tokens: 0,
              projectBreakdown: {},
            };
            entry.cost += cost;
            entry.tokens += tokens;
            entry.projectBreakdown[project.name] = (entry.projectBreakdown[project.name] || 0) + cost;
            dailyMap.set(date, entry);
          } catch {
            continue;
          }
        }

        // Count unique sessions per day
        const sessionDate = new Date(session.modifiedAt).toISOString().slice(0, 10);
        const entry = dailyMap.get(sessionDate);
        if (entry) entry.sessions++;
      } catch {
        continue;
      }
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function getSessionData(projectPath: string, sessionId: string): SessionSummary | null {
  const projectDir = join(getClaudeDir(), "projects", projectPath);
  const sessionFile = join(projectDir, `${sessionId}.jsonl`);

  if (!existsSync(sessionFile)) return null;

  const messages = parseJsonlFile(sessionFile);
  const sessionDir = join(projectDir, sessionId);
  const agents = parseAgents(sessionDir, sessionId);

  return analyzeSession(messages, sessionId, projectPath, agents);
}

// ─── Active Sessions (for Mission Control) ───────────────────────────────────

export interface ActiveSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  projectRoot: string | null;
  lastActivity: string;
  startTime: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  model: string;
  isActive: boolean;
  recentMessages: ParsedMessage[];
  agentCount: number;
  activeAgentCount: number;
}

export function getActiveSessions(thresholdMinutes: number = 10): ActiveSession[] {
  const cutoff = Date.now() - thresholdMinutes * 60 * 1000;
  const projects = listProjects();
  const activeSessions: ActiveSession[] = [];

  for (const project of projects) {
    for (const session of project.sessions) {
      // Only check recently modified files
      if (session.modifiedAt.getTime() < cutoff) continue;

      const data = getSessionData(project.path, session.id);
      if (!data) continue;

      const lastActivityTime = data.lastActivity ? new Date(data.lastActivity).getTime() : 0;
      const isActive = lastActivityTime > cutoff;

      // Get the last 30 messages for the feed
      const recentMessages = data.messages.slice(-30);

      // Determine primary model
      const modelEntries = Object.entries(data.modelBreakdown);
      const primaryModel = modelEntries.length > 0
        ? modelEntries.sort((a, b) => b[1].count - a[1].count)[0][0]
        : "Unknown";

      const agents = data.agents;
      const activeAgentCount = agents.filter((a) => a.status === "running").length;

      activeSessions.push({
        sessionId: data.sessionId,
        projectPath: project.path,
        projectName: data.projectName,
        projectRoot: project.root,
        lastActivity: data.lastActivity,
        startTime: data.startTime,
        totalCost: data.totalCost,
        totalTokens: data.totalTokens,
        messageCount: data.messageCount,
        model: primaryModel,
        isActive,
        recentMessages,
        agentCount: agents.length,
        activeAgentCount,
      });
    }
  }

  // Sort: active first, then by last activity
  activeSessions.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  return activeSessions;
}
