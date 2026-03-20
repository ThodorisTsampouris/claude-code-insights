export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface AgentInfo {
  id: string;
  parentSessionId: string;
  description?: string;
  status: "running" | "completed" | "unknown";
  totalCost: number;
  totalTokens: TokenUsage;
  startTime?: string;
  lastActivity?: string;
  model?: string;
  messageCount: number;
}

export interface ModelBreakdown {
  count: number;
  cost: number;
  tokens: TokenUsage;
}

export interface MessageInfo {
  uuid: string;
  type: string;
  timestamp: string;
  model?: string;
  cost?: number;
  usage?: TokenUsage;
  toolUse?: { name: string; input?: Record<string, unknown> };
  stopReason?: string;
  content?: string;
  isSidechain?: boolean;
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
  turnIndex: number;
}

export interface ContextSnapshot {
  timestamp: string;
  inputTokens: number;
}

export interface SessionData {
  sessionId: string;
  projectPath: string;
  projectName: string;
  startTime: string;
  lastActivity: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  modelBreakdown: Record<string, ModelBreakdown>;
  toolUsage: Record<string, number>;
  messages: MessageInfo[];
  agents: AgentInfo[];
  costOverTime: { timestamp: string; cumulativeCost: number; model: string }[];
  fileActivity: FileActivity[];
  costPerTurn: CostPerTurn[];
  timeline: TimelineEvent[];
  compactions: CompactionEvent[];
  contextSnapshots: ContextSnapshot[];
  contextLimit: number;
}

export interface ProjectInfo {
  path: string;
  name: string;
  sessions: { id: string; file: string; modifiedAt: string; size: number }[];
}

export interface DailySpending {
  date: string;
  cost: number;
  sessions: number;
  tokens: number;
  projectBreakdown: Record<string, number>;
}

export interface ActiveSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  lastActivity: string;
  startTime: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  model: string;
  isActive: boolean;
  recentMessages: MessageInfo[];
  agentCount: number;
  activeAgentCount: number;
}

// ─── Agent & Skill Configuration ────────────────────────────────────────────

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  tools: string[];
  model?: string;
  color?: string;
  prompt: string;
  source: string;
  filePath: string;
  editable: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  content: string;
  source: string;
  filePath: string;
  editable: boolean;
}

export interface ProjectSpending {
  name: string;
  cost: number;
  sessions: number;
}

export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  argumentHint?: string;
  allowedTools?: string[];
  model?: string;
  disableModelInvocation?: boolean;
  content: string;
  source: string;
  filePath: string;
  editable: boolean;
}

export interface HookEntry {
  type: "command" | "prompt";
  command?: string;
  prompt?: string;
  timeout?: number;
}

export interface HookDefinition {
  id: string;
  event: string;
  hooks: HookEntry[];
  matcher?: string;
  source: string;
  editable: boolean;
}

export interface ClaudeMdFile {
  path: string;
  location: "project-root" | "project-claude" | "global";
  label: string;
  content: string;
  exists: boolean;
}
