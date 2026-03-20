"use client";

import { useEffect, useState, useCallback } from "react";
import type { ClaudeMdFile } from "@/lib/types";

export function ClaudeMdEditor({ project }: { project?: string }) {
  const [files, setFiles] = useState<ClaudeMdFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const fetchFiles = useCallback(() => {
    const params = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/api/claude-md${params}`)
      .then((r) => r.json())
      .then((data: ClaudeMdFile[]) => {
        setFiles(data);
        // Select first existing file, or first overall
        const existingIdx = data.findIndex((f) => f.exists);
        const idx = existingIdx >= 0 ? existingIdx : 0;
        setActiveIdx(idx);
        setContent(data[idx]?.content || "");
        setOriginalContent(data[idx]?.content || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [project]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const switchFile = (idx: number) => {
    setActiveIdx(idx);
    setContent(files[idx]?.content || "");
    setOriginalContent(files[idx]?.content || "");
    setSaveStatus("idle");
  };

  const hasChanges = content !== originalContent;
  const activeFile = files[activeIdx];

  const handleSave = async () => {
    if (!activeFile) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/claude-md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFile.path, content, project }),
      });
      if (res.ok) {
        setOriginalContent(content);
        setSaveStatus("saved");
        // Update files state
        setFiles((prev) =>
          prev.map((f, i) =>
            i === activeIdx ? { ...f, content, exists: true } : f
          )
        );
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setContent(originalContent);
    setSaveStatus("idle");
  };

  // Line count for gutter
  const lineCount = content.split("\n").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold">CLAUDE.md</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Project instructions that override Claude&apos;s default behavior
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          {/* File tabs */}
          <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-secondary)]">
            {files.map((file, i) => (
              <button
                key={file.location}
                onClick={() => switchFile(i)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-medium transition-colors border-b-2 ${
                  activeIdx === i
                    ? "border-[var(--accent-purple)] text-[var(--accent-purple)] bg-[var(--bg-card)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <span>{file.label}</span>
                {file.exists ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" title="File exists" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--border)]" title="Will be created" />
                )}
                {i === activeIdx && hasChanges && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-orange)]" title="Unsaved changes" />
                )}
              </button>
            ))}

            {/* Spacer + Save controls */}
            <div className="flex-1" />
            <div className="flex items-center gap-2 px-3">
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--accent-green)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-[10px] text-[var(--accent-red)]">Save failed</span>
              )}
              {hasChanges && (
                <button
                  onClick={handleDiscard}
                  className="rounded-md px-2.5 py-1 text-[10px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                  Discard
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[10px] font-medium transition-all ${
                  hasChanges
                    ? "bg-[var(--accent-purple)] text-white hover:opacity-90"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-default"
                }`}
              >
                {saving && <div className="h-2.5 w-2.5 animate-spin-slow rounded-full border border-white/30 border-t-white" />}
                {activeFile?.exists ? "Save" : "Create"}
              </button>
            </div>
          </div>

          {/* Info bar */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-1.5 bg-[var(--bg-secondary)]">
            <span className="font-mono text-[9px] text-[var(--text-secondary)] truncate" title={activeFile?.path}>{activeFile?.path}</span>
            <span className="text-[9px] text-[var(--text-secondary)]">&middot;</span>
            <span className="text-[9px] text-[var(--text-secondary)]">{lineCount} lines</span>
            {!activeFile?.exists && (
              <>
                <span className="text-[9px] text-[var(--text-secondary)]">&middot;</span>
                <span className="text-[9px] text-[var(--accent-yellow)]">New file — will be created on save</span>
              </>
            )}
          </div>

          {/* Editor */}
          <div className="flex">
            {/* Line numbers */}
            <div className="shrink-0 select-none border-r border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-3 text-right">
              {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
                <div key={i} className="text-[10px] leading-[1.65rem] text-[var(--text-secondary)] opacity-40">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setSaveStatus("idle");
              }}
              onKeyDown={(e) => {
                // Cmd+S / Ctrl+S to save
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  if (hasChanges) handleSave();
                }
                // Tab inserts spaces
                if (e.key === "Tab") {
                  e.preventDefault();
                  const target = e.target as HTMLTextAreaElement;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  setContent(content.slice(0, start) + "  " + content.slice(end));
                  // Restore cursor position after React re-render
                  requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  });
                }
              }}
              spellCheck={false}
              className="flex-1 min-h-[500px] resize-y bg-transparent px-4 py-3 font-mono text-xs leading-[1.65rem] text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]"
              placeholder={`# Project Instructions\n\nAdd instructions here that Claude will follow when working in this project.\n\n## Code Style\n- Use TypeScript\n- Prefer functional components\n\n## Architecture\n- Follow the existing patterns in src/`}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-1.5">
            <span className="text-[9px] text-[var(--text-secondary)]">
              Markdown &middot; {hasChanges ? "Unsaved changes" : "No changes"} &middot; Cmd+S to save
            </span>
            <span className="text-[9px] text-[var(--text-secondary)]">
              {content.length} characters
            </span>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">About CLAUDE.md</div>
        <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
          <p>
            <strong className="text-[var(--text-primary)]">Project Root</strong> — Loaded for everyone working in this project. Best for shared coding standards and architecture rules.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Project .claude/</strong> — Same as project root but inside the .claude directory. Useful to keep the root clean.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">Global</strong> — Loaded for every project on your machine. Best for personal preferences that apply everywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
