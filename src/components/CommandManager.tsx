"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "./Modal";
import type { CommandDefinition } from "@/lib/types";

const AVAILABLE_TOOLS = [
  "Read", "Edit", "Write", "Glob", "Grep", "Bash", "Agent",
  "WebFetch", "WebSearch", "NotebookEdit", "NotebookRead",
  "TodoWrite", "LS", "AskUserQuestion", "Task", "Skill",
];

const MODELS = [
  { value: "", label: "Default" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

interface FormState {
  name: string;
  description: string;
  argumentHint: string;
  allowedTools: string[];
  model: string;
  disableModelInvocation: boolean;
  content: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  argumentHint: "",
  allowedTools: [],
  model: "",
  disableModelInvocation: false,
  content: "",
};

export function CommandManager() {
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "custom" | "plugin">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCmd, setViewCmd] = useState<CommandDefinition | null>(null);
  const [editingCmd, setEditingCmd] = useState<CommandDefinition | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchCommands = useCallback(() => {
    fetch("/api/commands")
      .then((r) => r.json())
      .then((data) => { setCommands(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCommands(); }, [fetchCommands]);

  const filtered = commands.filter((c) => {
    if (filter === "custom" && c.source !== "Custom") return false;
    if (filter === "plugin" && c.source === "Custom") return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.source.toLowerCase().includes(q);
    }
    return true;
  });

  const openCreate = () => {
    setEditingCmd(null);
    setForm(emptyForm);
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (cmd: CommandDefinition) => {
    setEditingCmd(cmd);
    setForm({
      name: cmd.name,
      description: cmd.description,
      argumentHint: cmd.argumentHint || "",
      allowedTools: cmd.allowedTools || [],
      model: cmd.model || "",
      disableModelInvocation: cmd.disableModelInvocation || false,
      content: cmd.content,
    });
    setError("");
    setEditorOpen(true);
  };

  const openView = (cmd: CommandDefinition) => {
    setViewCmd(cmd);
    setViewOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      setError("Name and description are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        argumentHint: form.argumentHint.trim() || undefined,
        allowedTools: form.allowedTools.length > 0 ? form.allowedTools : undefined,
        model: form.model || undefined,
        disableModelInvocation: form.disableModelInvocation || undefined,
        content: form.content.trim(),
        ...(editingCmd ? { filePath: editingCmd.filePath } : {}),
      };
      const res = await fetch("/api/commands", {
        method: editingCmd ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setEditorOpen(false);
      fetchCommands();
    } catch {
      setError("Failed to save command");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cmd: CommandDefinition) => {
    try {
      const res = await fetch(`/api/commands?filePath=${encodeURIComponent(cmd.filePath)}`, { method: "DELETE" });
      if (res.ok) { setDeleteConfirm(null); fetchCommands(); }
    } catch { /* ignore */ }
  };

  const toggleTool = (tool: string) => {
    setForm((f) => ({
      ...f,
      allowedTools: f.allowedTools.includes(tool) ? f.allowedTools.filter((t) => t !== tool) : [...f.allowedTools, tool],
    }));
  };

  const customCount = commands.filter((c) => c.source === "Custom").length;
  const pluginCount = commands.filter((c) => c.source !== "Custom").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Slash Commands</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {customCount} custom &middot; {pluginCount} from plugins
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent-green)] px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Command
        </button>
      </div>

      {/* Search & Filter */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-green)] focus:outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
          {(["all", "custom", "plugin"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                filter === f ? "bg-[var(--bg-card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Commands List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-green)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)]">
          <svg className="mb-3 h-10 w-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-[var(--text-secondary)]">{search ? "No commands match your search" : "No commands found"}</p>
          {!search && filter === "all" && (
            <button onClick={openCreate} className="mt-3 text-[10px] text-[var(--accent-green)] hover:underline">Create your first command</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cmd) => (
            <div
              key={cmd.id}
              className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 transition-all hover:bg-[var(--bg-card-hover)]"
            >
              {/* Slash icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-secondary)]">
                <span className="text-sm font-bold text-[var(--accent-green)]">/</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">/{cmd.name}</span>
                  {cmd.argumentHint && (
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">{cmd.argumentHint}</span>
                  )}
                  {cmd.model && (
                    <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{cmd.model}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] truncate">{cmd.description}</p>
                <span className="mt-0.5 inline-block rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                  {cmd.source === "Custom" ? "Custom" : cmd.source}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openView(cmd)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]" title="View">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                {cmd.editable && (
                  <>
                    <button onClick={() => openEdit(cmd)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-blue)]" title="Edit">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {deleteConfirm === cmd.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(cmd)} className="rounded-md bg-[var(--accent-red)] px-2 py-1 text-[9px] font-medium text-white">Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} className="rounded-md bg-[var(--bg-secondary)] px-2 py-1 text-[9px] text-[var(--text-secondary)]">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(cmd.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-red)]" title="Delete">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewCmd ? `/${viewCmd.name}` : "Command Details"}>
        {viewCmd && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">{viewCmd.source}</span>
              {viewCmd.model && <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{viewCmd.model}</span>}
              {viewCmd.argumentHint && <span className="font-mono text-[10px] text-[var(--text-secondary)]">{viewCmd.argumentHint}</span>}
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Description</div>
              <p className="text-xs leading-relaxed text-[var(--text-primary)]">{viewCmd.description}</p>
            </div>

            {viewCmd.allowedTools && viewCmd.allowedTools.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Allowed Tools</div>
                <div className="flex flex-wrap gap-1.5">
                  {viewCmd.allowedTools.map((tool) => (
                    <span key={tool} className="rounded-md bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-mono text-[var(--text-primary)]">{tool}</span>
                  ))}
                </div>
              </div>
            )}

            {viewCmd.content && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Prompt Template</div>
                <pre className="max-h-[300px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{viewCmd.content}</pre>
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border)]">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">File Path</div>
              <p className="font-mono text-[10px] text-[var(--text-secondary)] break-all">{viewCmd.filePath}</p>
            </div>

            {viewCmd.editable && (
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setViewOpen(false); openEdit(viewCmd); }} className="flex-1 rounded-lg bg-[var(--accent-green)] py-2 text-xs font-medium text-white transition-all hover:opacity-90">Edit Command</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Editor Modal */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingCmd ? `Edit /${editingCmd.name}` : "Create New Command"}>
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-[var(--accent-red)] bg-[#f8717110] px-3 py-2 text-xs text-[var(--accent-red)]">{error}</div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Command Name <span className="text-[var(--accent-red)]">*</span>
            </label>
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] transition-colors focus-within:border-[var(--accent-green)]">
              <span className="pl-3 text-sm font-bold text-[var(--accent-green)]">/</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my-command"
                className="flex-1 bg-transparent px-1 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Description <span className="text-[var(--accent-red)]">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What this command does"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-green)] focus:outline-none transition-colors"
            />
          </div>

          {/* Argument hint + Model row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Argument Hint</label>
              <input
                type="text"
                value={form.argumentHint}
                onChange={(e) => setForm((f) => ({ ...f, argumentHint: e.target.value }))}
                placeholder="<file> [--flag]"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-green)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Model</label>
              <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setForm((f) => ({ ...f, model: m.value }))}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                      form.model === m.value ? "bg-[var(--bg-card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Allowed Tools */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Allowed Tools ({form.allowedTools.length} selected)
              </label>
              <button
                onClick={() => setForm((f) => ({ ...f, allowedTools: f.allowedTools.length === AVAILABLE_TOOLS.length ? [] : [...AVAILABLE_TOOLS] }))}
                className="text-[10px] text-[var(--accent-green)] hover:underline"
              >
                {form.allowedTools.length === AVAILABLE_TOOLS.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              {AVAILABLE_TOOLS.map((tool) => {
                const selected = form.allowedTools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`rounded-md px-2 py-1 text-[10px] font-mono transition-all ${
                      selected ? "bg-[var(--accent-green)] text-white" : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Template */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Prompt Template
            </label>
            <p className="mb-2 text-[10px] text-[var(--text-secondary)]">
              Use <code className="rounded bg-[var(--bg-secondary)] px-1">$ARGUMENTS</code> to reference user-provided arguments
            </p>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Instructions for what this command should do...&#10;&#10;The user provided: $ARGUMENTS"
              rows={10}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-green)] focus:outline-none transition-colors resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button onClick={() => setEditorOpen(false)} className="rounded-lg px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent-green)] px-5 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving && <div className="h-3 w-3 animate-spin-slow rounded-full border border-white/30 border-t-white" />}
              {editingCmd ? "Save Changes" : "Create Command"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
