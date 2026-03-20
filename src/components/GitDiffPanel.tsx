"use client";

import { useState } from "react";
import type { GitDiffResponse } from "@/lib/types";

function timeAgo(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function GitDiffPanel({
  data,
  loading,
}: {
  data: GitDiffResponse | null;
  loading: boolean;
}) {
  const [showStat, setShowStat] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--accent-purple)] border-t-transparent" />
        Loading git history...
      </div>
    );
  }

  if (!data) return null;

  if (!data.supported) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {data.error || "Git not available for this project"}
      </div>
    );
  }

  if (data.commits.length === 0) {
    return (
      <div className="text-[11px] text-[var(--text-secondary)]">
        No commits made during this session.
      </div>
    );
  }

  const visibleCommits = data.commits.slice(0, 10);
  const overflow = data.commits.length - 10;

  return (
    <div className="space-y-4">
      {/* Stat pills */}
      <div className="flex flex-wrap items-center gap-2">
        {data.filesChanged > 0 && (
          <span className="rounded-full bg-[var(--accent-blue)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent-blue)]">
            {data.filesChanged} {data.filesChanged === 1 ? "file" : "files"} changed
          </span>
        )}
        {data.insertions > 0 && (
          <span className="rounded-full bg-[#4ade80]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#4ade80]">
            +{data.insertions.toLocaleString()}
          </span>
        )}
        {data.deletions > 0 && (
          <span className="rounded-full bg-[#f87171]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#f87171]">
            -{data.deletions.toLocaleString()}
          </span>
        )}
      </div>

      {/* Commit list */}
      <div className="space-y-1.5">
        {visibleCommits.map((c) => (
          <div key={c.hash} className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] text-[var(--accent-blue)] shrink-0">
              {c.shortHash}
            </span>
            <span className="flex-1 truncate text-[11px] text-[var(--text-primary)]">
              {c.message}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">
              {timeAgo(c.time)}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <div className="text-[10px] text-[var(--text-secondary)]">
            +{overflow} more commit{overflow === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* Collapsible stat output */}
      {data.stat && (
        <div>
          <button
            onClick={() => setShowStat((s) => !s)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showStat ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showStat ? "Hide" : "Show"} diff stat
          </button>
          {showStat && (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--bg-secondary)] p-3 text-[10px] text-[var(--text-secondary)] leading-relaxed">
              {data.stat}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
