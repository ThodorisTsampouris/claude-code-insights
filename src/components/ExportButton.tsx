"use client";

import { useState, useCallback } from "react";
import type { SessionData } from "@/lib/types";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "unknown";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

function generateMarkdown(session: SessionData): string {
  const date = session.startTime
    ? new Date(session.startTime).toLocaleString()
    : "Unknown";
  const duration =
    session.startTime && session.lastActivity
      ? formatDuration(session.startTime, session.lastActivity)
      : "Unknown";

  const totalEdits = session.fileActivity.reduce(
    (s, f) => s + f.edits + f.writes,
    0,
  );

  const lines: string[] = [
    `# Session Export: ${session.projectName}`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Session ID | \`${session.sessionId}\` |`,
    `| Date | ${date} |`,
    `| Duration | ${duration} |`,
    `| Total Cost | ${formatCost(session.totalCost)} |`,
    `| Messages | ${session.messageCount} |`,
    `| File Edits | ${totalEdits} |`,
    session.projectRoot ? `| Project Path | \`${session.projectRoot}\` |` : "",
    ``,
    `> **Note:** Assistant message bodies are not included in dashboard data to reduce memory usage.`,
    `> Tool call inputs are summarized by name only.`,
    ``,
    `---`,
    ``,
    `## Conversation`,
    ``,
  ];

  if (session.costPerTurn.length === 0) {
    lines.push("*No conversation turns recorded.*");
  } else {
    session.costPerTurn.forEach((turn, i) => {
      const time = turn.userTimestamp
        ? new Date(turn.userTimestamp).toLocaleTimeString()
        : "";
      lines.push(`### Turn ${i + 1}${time ? ` · ${time}` : ""}`);
      lines.push(``);
      lines.push(`**User**`);
      lines.push(``);
      lines.push(turn.userContent || "*[No content]*");
      lines.push(``);
      lines.push(
        `**Assistant** · ${formatCost(turn.cost)} · ${turn.tokens.toLocaleString()} tokens`,
      );
      if (turn.toolCalls.length > 0) {
        lines.push(``);
        lines.push(`*Tool calls:*`);
        turn.toolCalls.forEach((t) => lines.push(`- \`${t}\``));
      }
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    });
  }

  if (session.fileActivity.length > 0) {
    lines.push(`## File Activity`);
    lines.push(``);
    lines.push(`| File | Reads | Edits | Writes |`);
    lines.push(`|------|-------|-------|--------|`);
    session.fileActivity.slice(0, 20).forEach((f) => {
      lines.push(`| \`${f.shortPath}\` | ${f.reads} | ${f.edits} | ${f.writes} |`);
    });
    if (session.fileActivity.length > 20) {
      lines.push(``);
      lines.push(
        `*... and ${session.fileActivity.length - 20} more files*`,
      );
    }
  }

  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({
  session,
  size = "md",
}: {
  session: SessionData;
  size?: "sm" | "md";
}) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const content = generateMarkdown(session);
      const dateStr = session.startTime
        ? new Date(session.startTime).toISOString().slice(0, 10)
        : "unknown";
      const filename = `${session.projectName}-${session.sessionId.slice(0, 8)}-${dateStr}.md`;
      downloadMarkdown(content, filename);
      setDownloading(true);
      setTimeout(() => setDownloading(false), 1500);
    },
    [session],
  );

  const btnSize = size === "md" ? "h-7 w-7" : "h-6 w-6";
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleExport}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          handleExport(e as unknown as React.MouseEvent);
      }}
      title={downloading ? "Downloaded!" : "Export session as Markdown"}
      className={`flex items-center justify-center rounded-lg transition-colors cursor-pointer ${btnSize} ${
        downloading
          ? "text-[var(--accent-green)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {downloading ? (
        <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      )}
    </div>
  );
}
