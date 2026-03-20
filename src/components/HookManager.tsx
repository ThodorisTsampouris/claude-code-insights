"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "./Modal";
import type { HookDefinition } from "@/lib/types";

const HOOK_EVENTS = [
  { value: "PreToolUse", label: "Pre Tool Use", desc: "Before a tool executes — can block" },
  { value: "PostToolUse", label: "Post Tool Use", desc: "After a tool completes" },
  { value: "Stop", label: "Stop", desc: "When session is about to end" },
  { value: "SubagentStop", label: "Subagent Stop", desc: "When a subagent finishes" },
  { value: "SessionStart", label: "Session Start", desc: "At session initialization" },
  { value: "UserPromptSubmit", label: "User Prompt Submit", desc: "When user submits a prompt" },
  { value: "PreCompact", label: "Pre Compact", desc: "Before context compaction" },
  { value: "Notification", label: "Notification", desc: "System notifications" },
];

const EVENT_COLORS: Record<string, string> = {
  PreToolUse: "var(--accent-orange)",
  PostToolUse: "var(--accent-blue)",
  Stop: "var(--accent-red)",
  SubagentStop: "var(--accent-pink, #f472b6)",
  SessionStart: "var(--accent-green)",
  UserPromptSubmit: "var(--accent-purple)",
  PreCompact: "var(--accent-yellow)",
  Notification: "var(--accent-cyan, #22d3ee)",
};

interface FormState {
  event: string;
  hookType: "command" | "prompt";
  command: string;
  prompt: string;
  timeout: string;
  matcher: string;
  scope: "global" | "project";
}

const emptyForm: FormState = {
  event: "PreToolUse",
  hookType: "command",
  command: "",
  prompt: "",
  timeout: "",
  matcher: "",
  scope: "global",
};

export function HookManager({ project }: { project?: string }) {
  const [hooks, setHooks] = useState<HookDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchHooks = useCallback(() => {
    const params = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/api/hooks${params}`)
      .then((r) => r.json())
      .then((data) => { setHooks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  useEffect(() => { fetchHooks(); }, [fetchHooks]);

  // Group hooks by event
  const grouped = HOOK_EVENTS.map((ev) => ({
    ...ev,
    hooks: hooks.filter((h) => h.event === ev.value),
  }));

  const totalHooks = hooks.length;
  const editableHooks = hooks.filter((h) => h.editable).length;

  const openCreate = (event?: string) => {
    setForm({ ...emptyForm, event: event || "PreToolUse" });
    setError("");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (form.hookType === "command" && !form.command.trim()) {
      setError("Command is required");
      return;
    }
    if (form.hookType === "prompt" && !form.prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: form.event,
          hookType: form.hookType,
          command: form.hookType === "command" ? form.command.trim() : undefined,
          prompt: form.hookType === "prompt" ? form.prompt.trim() : undefined,
          timeout: form.timeout ? parseInt(form.timeout, 10) : undefined,
          matcher: form.matcher.trim() || undefined,
          scope: form.scope,
          project,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setEditorOpen(false);
      setExpandedEvent(form.event);
      fetchHooks();
    } catch {
      setError("Failed to create hook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hook: HookDefinition) => {
    try {
      const params = new URLSearchParams({ id: hook.id });
      if (project) params.set("project", project);
      const res = await fetch(`/api/hooks?${params}`, { method: "DELETE" });
      if (res.ok) { setDeleteConfirm(null); fetchHooks(); }
    } catch { /* ignore */ }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Hooks</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {totalHooks} hooks &middot; {editableHooks} editable
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent-orange)] px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Hook
        </button>
      </div>

      {/* Event groups */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-orange)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((group) => {
            const isExpanded = expandedEvent === group.value;
            const hasHooks = group.hooks.length > 0;
            const color = EVENT_COLORS[group.value] || "var(--accent-blue)";

            return (
              <div key={group.value} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                {/* Event header */}
                <button
                  onClick={() => setExpandedEvent(isExpanded ? null : group.value)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{group.label}</span>
                      {hasHooks && (
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${color}15`, color }}>
                          {group.hooks.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">{group.desc}</p>
                  </div>
                  <svg
                    className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded hooks */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
                    {group.hooks.length === 0 ? (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">No hooks for this event</span>
                        <button
                          onClick={() => openCreate(group.value)}
                          className="text-[10px] font-medium hover:underline"
                          style={{ color }}
                        >
                          Add hook
                        </button>
                      </div>
                    ) : (
                      <>
                        {group.hooks.map((hook) => (
                          <div
                            key={hook.id}
                            className="group/hook flex items-start gap-3 rounded-lg bg-[var(--bg-secondary)] p-3"
                          >
                            {/* Type badge */}
                            <div className="mt-0.5 shrink-0">
                              {hook.hooks[0]?.type === "prompt" ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-purple)]20">
                                  <svg className="h-3 w-3 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-orange)]20">
                                  <svg className="h-3 w-3 text-[var(--accent-orange)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Hook details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color }}>
                                  {hook.hooks[0]?.type || "command"}
                                </span>
                                <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                                  {hook.source}
                                </span>
                                {hook.matcher && (
                                  <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)]">
                                    matcher: {hook.matcher}
                                  </span>
                                )}
                                {hook.hooks[0]?.timeout && (
                                  <span className="text-[9px] text-[var(--text-secondary)]">
                                    {hook.hooks[0].timeout}s timeout
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-[var(--text-primary)] break-all">
                                {hook.hooks[0]?.command || hook.hooks[0]?.prompt || "—"}
                              </div>
                            </div>

                            {/* Delete */}
                            {hook.editable && (
                              <div className="shrink-0 opacity-0 group-hover/hook:opacity-100 transition-opacity">
                                {deleteConfirm === hook.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(hook)} className="rounded-md bg-[var(--accent-red)] px-2 py-1 text-[9px] font-medium text-white">Delete</button>
                                    <button onClick={() => setDeleteConfirm(null)} className="rounded-md bg-[var(--bg-card)] px-2 py-1 text-[9px] text-[var(--text-secondary)]">Cancel</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(hook.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--accent-red)]"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => openCreate(group.value)}
                          className="mt-1 text-[10px] font-medium hover:underline"
                          style={{ color }}
                        >
                          + Add another hook
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Hook Modal */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title="Create New Hook">
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-[var(--accent-red)] bg-[#f8717110] px-3 py-2 text-xs text-[var(--accent-red)]">{error}</div>
          )}

          {/* Event type */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Event <span className="text-[var(--accent-red)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {HOOK_EVENTS.map((ev) => {
                const color = EVENT_COLORS[ev.value] || "var(--accent-blue)";
                const selected = form.event === ev.value;
                return (
                  <button
                    key={ev.value}
                    onClick={() => setForm((f) => ({ ...f, event: ev.value }))}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                      selected
                        ? "bg-[var(--bg-secondary)] ring-1"
                        : "bg-[var(--bg-secondary)] opacity-50 hover:opacity-80"
                    }`}
                    style={selected ? { outlineColor: color, outlineWidth: "1px", outlineStyle: "solid", outlineOffset: "-1px", borderRadius: "0.5rem" } : undefined}
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <div className="text-[10px] font-medium text-[var(--text-primary)]">{ev.label}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">{ev.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hook type */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Type <span className="text-[var(--accent-red)]">*</span>
            </label>
            <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
              <button
                onClick={() => setForm((f) => ({ ...f, hookType: "command" }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
                  form.hookType === "command" ? "bg-[var(--bg-card)] text-[var(--accent-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Command
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, hookType: "prompt" }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
                  form.hookType === "prompt" ? "bg-[var(--bg-card)] text-[var(--accent-purple)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                Prompt
              </button>
            </div>
          </div>

          {/* Command or Prompt */}
          {form.hookType === "command" ? (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Command <span className="text-[var(--accent-red)]">*</span>
              </label>
              <input
                type="text"
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                placeholder="python3 /path/to/script.py"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-orange)] focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[9px] text-[var(--text-secondary)]">Shell command to execute. Receives hook data via stdin JSON.</p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Prompt <span className="text-[var(--accent-red)]">*</span>
              </label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                placeholder="Check if the code follows best practices and security guidelines..."
                rows={4}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors resize-none"
              />
              <p className="mt-1 text-[9px] text-[var(--text-secondary)]">Natural language prompt evaluated by Claude to decide the hook action.</p>
            </div>
          )}

          {/* Matcher + Timeout row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Matcher (optional)
              </label>
              <input
                type="text"
                value={form.matcher}
                onChange={(e) => setForm((f) => ({ ...f, matcher: e.target.value }))}
                placeholder="Edit|Write|MultiEdit"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-orange)] focus:outline-none transition-colors"
              />
              <p className="mt-1 text-[9px] text-[var(--text-secondary)]">Regex pattern to filter which tools trigger this hook</p>
            </div>
            {form.hookType === "command" && (
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={form.timeout}
                  onChange={(e) => setForm((f) => ({ ...f, timeout: e.target.value }))}
                  placeholder="10"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-orange)] focus:outline-none transition-colors"
                />
              </div>
            )}
          </div>

          {/* Scope */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Scope
            </label>
            <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
              <button
                onClick={() => setForm((f) => ({ ...f, scope: "global" }))}
                className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  form.scope === "global" ? "bg-[var(--bg-card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Global
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, scope: "project" }))}
                disabled={!project}
                className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  form.scope === "project" ? "bg-[var(--bg-card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                } ${!project ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Project
              </button>
            </div>
            {(() => {
              const fullPath = form.scope === "global"
                ? "~/.claude/settings.json"
                : project
                  ? `${project.replace(/^-/, "/").replace(/-/g, "/")}/.claude/settings.local.json`
                  : "No project selected — choose one from the Config dropdown";
              return (
                <div className="mt-1.5 rounded-md bg-[var(--bg-secondary)] px-2.5 py-1.5 group/path relative cursor-default">
                  <div className="font-mono text-[9px] text-[var(--text-secondary)] truncate">
                    {fullPath}
                  </div>
                  <div className="pointer-events-none absolute left-0 bottom-full mb-1 z-50 hidden group-hover/path:block max-w-[400px] rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 shadow-lg">
                    <div className="font-mono text-[10px] text-[var(--text-primary)] break-all">
                      {fullPath}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button onClick={() => setEditorOpen(false)} className="rounded-lg px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent-orange)] px-5 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving && <div className="h-3 w-3 animate-spin-slow rounded-full border border-white/30 border-t-white" />}
              Create Hook
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
