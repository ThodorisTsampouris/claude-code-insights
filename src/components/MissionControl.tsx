"use client";

import { useEffect, useState, useRef } from "react";
import type { ActiveSession, MessageInfo } from "@/lib/types";
import { CopyResumeButton } from "@/components/CopyResumeButton";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function shortenPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 2) return p;
  return parts.slice(-2).join("/");
}

function getModelColor(model: string): string {
  if (model === "Opus") return "#a78bfa";
  if (model === "Sonnet") return "#60a5fa";
  if (model === "Haiku") return "#4ade80";
  return "#8888a4";
}

// ─── Feed item builder (reuse logic from LiveFeed) ───────────────────────────

interface MiniItem {
  id: string;
  timestamp: string;
  icon: string;
  color: string;
  label: string;
  detail: string;
  projectName: string;
  projectColor: string;
  cost?: number;
}

const PROJECT_COLORS = [
  "#a78bfa", "#60a5fa", "#4ade80", "#fb923c", "#f472b6",
  "#22d3ee", "#fbbf24", "#f87171", "#34d399", "#a3e635",
];

function buildMiniItems(sessions: ActiveSession[]): MiniItem[] {
  const items: MiniItem[] = [];
  const colorMap = new Map<string, string>();
  let colorIdx = 0;

  for (const session of sessions) {
    if (!colorMap.has(session.projectName)) {
      colorMap.set(session.projectName, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]);
      colorIdx++;
    }
    const projectColor = colorMap.get(session.projectName)!;

    for (const msg of session.recentMessages) {
      if (!msg.timestamp) continue;
      if (msg.isSidechain) continue;

      if (msg.type === "user" && msg.content && !msg.content.startsWith("<")) {
        items.push({
          id: `${session.sessionId}-${msg.uuid}`,
          timestamp: msg.timestamp,
          icon: "user",
          color: "#3b82f6",
          label: "You",
          detail: msg.content.slice(0, 120),
          projectName: session.projectName,
          projectColor,
        });
      } else if (msg.type === "assistant" && msg.toolUse) {
        const tool = msg.toolUse.name;
        const input = msg.toolUse.input || {};
        let detail = "";
        let color = "#fb923c";

        if (tool === "Read") {
          detail = shortenPath((input.file_path as string) || "");
          color = "#60a5fa";
        } else if (tool === "Edit") {
          detail = shortenPath((input.file_path as string) || "");
          color = "#a78bfa";
        } else if (tool === "Write") {
          detail = shortenPath((input.file_path as string) || "");
          color = "#4ade80";
        } else if (tool === "Bash") {
          const cmd = (input.command as string) || "";
          detail = cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
          color = "#fb923c";
        } else if (tool === "Agent") {
          detail = (input.description as string) || "Sub-agent";
          color = "#f472b6";
        } else if (tool === "Glob" || tool === "Grep") {
          detail = (input.pattern as string) || "";
          color = "#fbbf24";
        } else {
          detail = "";
          color = "#8888a4";
        }

        items.push({
          id: `${session.sessionId}-${msg.uuid}`,
          timestamp: msg.timestamp,
          icon: tool,
          color,
          label: tool,
          detail,
          projectName: session.projectName,
          projectColor,
          cost: msg.cost,
        });
      } else if (msg.type === "assistant" && msg.content && !msg.toolUse) {
        items.push({
          id: `${session.sessionId}-${msg.uuid}`,
          timestamp: msg.timestamp,
          icon: "claude",
          color: "#a78bfa",
          label: "Claude",
          detail: msg.content.slice(0, 120),
          projectName: session.projectName,
          projectColor,
          cost: msg.cost,
        });
      }
    }
  }

  // Sort by timestamp
  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return items;
}

// ─── Session Card ────────────────────────────────────────────────────────────

function SessionCard({ session, color, onSelect }: {
  session: ActiveSession;
  color: string;
  onSelect: () => void;
}) {
  const totalTokens = session.totalTokens.inputTokens + session.totalTokens.outputTokens;

  // Get last meaningful message
  const lastMsg = [...session.recentMessages].reverse().find(
    (m) => (m.type === "assistant" && (m.toolUse || m.content)) || (m.type === "user" && m.content && !m.content.startsWith("<"))
  );

  let lastAction = "";
  if (lastMsg?.toolUse) {
    lastAction = lastMsg.toolUse.name;
    const input = lastMsg.toolUse.input || {};
    const fp = (input.file_path as string) || (input.command as string) || (input.pattern as string) || "";
    if (fp) lastAction += `: ${shortenPath(fp).slice(0, 40)}`;
  } else if (lastMsg?.content) {
    lastAction = lastMsg.content.slice(0, 50);
  }

  return (
    <button
      onClick={onSelect}
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left transition-all hover:border-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {session.isActive && (
            <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
          )}
          <span className="text-sm font-bold" style={{ color }}>
            {session.projectName}
          </span>
          <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px]" style={{ color: getModelColor(session.model) }}>
            {session.model}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <CopyResumeButton sessionId={session.sessionId} projectRoot={session.projectRoot} size="sm" />
          <span className="text-[10px] text-[var(--text-secondary)]">
            {timeAgo(session.lastActivity)}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-2 text-[10px]">
        <span className="text-[var(--accent-green)] font-bold text-sm">{formatCost(session.totalCost)}</span>
        <span className="text-[var(--text-secondary)]">{formatTokens(totalTokens)} tokens</span>
        <span className="text-[var(--text-secondary)]">{session.messageCount} msgs</span>
        {session.agentCount > 0 && (
          <span className="text-[var(--text-secondary)]">
            {session.activeAgentCount > 0 ? (
              <span className="text-[var(--accent-green)]">{session.activeAgentCount} active agents</span>
            ) : (
              `${session.agentCount} agents`
            )}
          </span>
        )}
      </div>

      {/* Last action */}
      {lastAction && (
        <div className="truncate text-[11px] text-[var(--text-secondary)] font-mono">
          {lastAction}
        </div>
      )}
    </button>
  );
}

// ─── Unified Feed Item ───────────────────────────────────────────────────────

function FeedRow({ item }: { item: MiniItem }) {
  return (
    <div className="flex items-start gap-3 py-1.5 group">
      {/* Time */}
      <span className="shrink-0 w-16 text-right text-[10px] text-[var(--text-secondary)] pt-0.5">
        {formatTime(item.timestamp)}
      </span>

      {/* Project tag */}
      <span
        className="shrink-0 w-20 truncate rounded px-1.5 py-0.5 text-[9px] font-medium text-center"
        style={{
          color: item.projectColor,
          backgroundColor: item.projectColor + "15",
        }}
      >
        {item.projectName}
      </span>

      {/* Action */}
      <span className="shrink-0 w-12 text-[11px] font-semibold" style={{ color: item.color }}>
        {item.label}
      </span>

      {/* Detail */}
      <span className="flex-1 min-w-0 truncate text-[11px] text-[var(--text-secondary)] font-mono">
        {item.detail}
      </span>

      {/* Cost */}
      {item.cost != null && item.cost > 0 && (
        <span className="shrink-0 text-[9px] text-[var(--accent-green)]">
          {formatCost(item.cost)}
        </span>
      )}
    </div>
  );
}

// ─── Main Mission Control ────────────────────────────────────────────────────

export function MissionControl({ onSelectSession }: {
  onSelectSession: (projectPath: string, sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(10);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchActive = () => {
      fetch(`/api/active?minutes=${timeRange}`)
        .then((r) => r.json())
        .then((data) => {
          setSessions(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchActive();
    const interval = setInterval(fetchActive, 3000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Auto-scroll feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions]);

  const activeSessions = sessions.filter((s) => s.isActive);
  const recentSessions = sessions.filter((s) => !s.isActive);
  const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);
  const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens.inputTokens + s.totalTokens.outputTokens, 0);

  // Build color map
  const colorMap = new Map<string, string>();
  let colorIdx = 0;
  for (const s of sessions) {
    if (!colorMap.has(s.projectName)) {
      colorMap.set(s.projectName, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length]);
      colorIdx++;
    }
  }

  const feedItems = buildMiniItems(sessions);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 mx-auto animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
          <p className="text-sm text-[var(--text-secondary)]">Scanning for active sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mission Control</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            All active Claude Code sessions in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
            {[5, 10, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => setTimeRange(m)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  timeRange === m
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Active Sessions</div>
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <span className="h-2.5 w-2.5 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
            )}
            <span className="text-2xl font-bold text-[var(--accent-green)]">{activeSessions.length}</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Total Cost</div>
          <div className="text-2xl font-bold text-[var(--accent-green)]">{formatCost(totalCost)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Total Tokens</div>
          <div className="text-2xl font-bold text-[var(--accent-blue)]">{formatTokens(totalTokens)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Active Agents</div>
          <div className="text-2xl font-bold text-[var(--accent-purple)]">
            {sessions.reduce((sum, s) => sum + s.activeAgentCount, 0)}
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.008v.008H12V12z" />
          </svg>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            No active sessions in the last {timeRange} minutes
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Start a Claude Code session and it will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* Session cards */}
          <div className="col-span-5 space-y-3">
            {activeSessions.length > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-[var(--accent-green)] font-medium px-1">
                Active ({activeSessions.length})
              </div>
            )}
            {activeSessions.map((s) => (
              <SessionCard
                key={s.sessionId}
                session={s}
                color={colorMap.get(s.projectName) || "#8888a4"}
                onSelect={() => onSelectSession(s.projectPath, s.sessionId)}
              />
            ))}

            {recentSessions.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium px-1 mt-4">
                  Recent ({recentSessions.length})
                </div>
                {recentSessions.map((s) => (
                  <SessionCard
                    key={s.sessionId}
                    session={s}
                    color={colorMap.get(s.projectName) || "#8888a4"}
                    onSelect={() => onSelectSession(s.projectPath, s.sessionId)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Unified feed */}
          <div className="col-span-7 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col" style={{ maxHeight: 600 }}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
                <span className="text-xs font-bold">Unified Activity Feed</span>
              </div>
              <span className="text-[10px] text-[var(--text-secondary)]">
                {feedItems.length} events across {sessions.length} sessions
              </span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
              {feedItems.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[var(--text-secondary)]">
                  No activity yet
                </div>
              ) : (
                feedItems.map((item) => <FeedRow key={item.id} item={item} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
