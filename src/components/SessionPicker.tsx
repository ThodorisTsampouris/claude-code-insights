"use client";

import type { ProjectInfo } from "@/lib/types";
import { CopyResumeButton } from "@/components/CopyResumeButton";
import { BookmarkButton } from "@/components/BookmarkButton";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SessionPicker({
  projects,
  selectedProject,
  selectedSession,
  onSelect,
  bookmarks,
  onToggleBookmark,
  showOnlyBookmarked,
  onToggleFilter,
}: {
  projects: ProjectInfo[];
  selectedProject: string | null;
  selectedSession: string | null;
  onSelect: (projectPath: string, sessionId: string) => void;
  bookmarks: string[];
  onToggleBookmark: (sessionId: string) => void;
  showOnlyBookmarked: boolean;
  onToggleFilter: () => void;
}) {
  // Filter and sort projects/sessions
  const filteredProjects = projects
    .map((project) => {
      const sortedSessions = [...project.sessions].sort((a, b) => {
        const aS = bookmarks.includes(a.id) ? 1 : 0;
        const bS = bookmarks.includes(b.id) ? 1 : 0;
        if (bS !== aS) return bS - aS;
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      });
      const sessions = showOnlyBookmarked
        ? sortedSessions.filter((s) => bookmarks.includes(s.id))
        : sortedSessions;
      return { ...project, sessions };
    })
    .filter((p) => p.sessions.length > 0);

  return (
    <div className="flex flex-col max-h-[calc(100vh-120px)]">
      {/* Filter toggle */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Sessions
        </span>
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleFilter}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleFilter(); }}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium cursor-pointer transition-colors ${
            showOnlyBookmarked
              ? "bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill={showOnlyBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {showOnlyBookmarked ? "Starred" : "All"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {filteredProjects.length === 0 && showOnlyBookmarked && (
          <div className="px-2 py-6 text-center text-[11px] text-[var(--text-secondary)]">
            No starred sessions yet.
            <br />
            <span className="text-[10px]">Star a session to bookmark it.</span>
          </div>
        )}

        {filteredProjects.map((project) => (
          <div key={project.path}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider truncate">
                {project.name}
              </span>
            </div>
            <div className="space-y-1">
              {project.sessions.map((session) => {
                const isSelected =
                  selectedProject === project.path && selectedSession === session.id;
                const starred = bookmarks.includes(session.id);
                return (
                  <button
                    key={session.id}
                    onClick={() => onSelect(project.path, session.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]10 glow-blue"
                        : "border-transparent bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BookmarkButton
                          starred={starred}
                          onToggle={(e) => {
                            e.stopPropagation();
                            onToggleBookmark(session.id);
                          }}
                        />
                        <span className="font-mono text-[11px] text-[var(--text-primary)] truncate">
                          {session.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <CopyResumeButton sessionId={session.id} projectRoot={project.root} size="sm" />
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {formatDate(session.modifiedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                      {formatSize(session.size)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
