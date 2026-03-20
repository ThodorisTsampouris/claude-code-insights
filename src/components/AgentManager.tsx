"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "./Modal";
import type { AgentDefinition } from "@/lib/types";

const AVAILABLE_TOOLS = [
  "Read", "Edit", "Write", "Glob", "Grep", "Bash", "Agent",
  "WebFetch", "WebSearch", "NotebookEdit", "NotebookRead",
  "TodoWrite", "LS", "KillShell", "BashOutput",
];

const AGENT_COLORS: { value: string; label: string; css: string }[] = [
  { value: "blue", label: "Blue", css: "var(--accent-blue)" },
  { value: "purple", label: "Purple", css: "var(--accent-purple)" },
  { value: "green", label: "Green", css: "var(--accent-green)" },
  { value: "orange", label: "Orange", css: "var(--accent-orange)" },
  { value: "red", label: "Red", css: "var(--accent-red)" },
  { value: "yellow", label: "Yellow", css: "var(--accent-yellow)" },
  { value: "pink", label: "Pink", css: "#f472b6" },
  { value: "cyan", label: "Cyan", css: "#22d3ee" },
];

const MODELS = [
  { value: "", label: "Default" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

function getColorCss(color?: string): string {
  return AGENT_COLORS.find((c) => c.value === color)?.css || "var(--accent-blue)";
}

interface FormState {
  name: string;
  description: string;
  tools: string[];
  model: string;
  color: string;
  prompt: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  tools: [],
  model: "",
  color: "blue",
  prompt: "",
};

export function AgentManager() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "custom" | "plugin">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewAgent, setViewAgent] = useState<AgentDefinition | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAgents = useCallback(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filtered = agents.filter((a) => {
    if (filter === "custom" && a.source !== "Custom") return false;
    if (filter === "plugin" && a.source === "Custom") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreate = () => {
    setEditingAgent(null);
    setForm(emptyForm);
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (agent: AgentDefinition) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
      model: agent.model || "",
      color: agent.color || "blue",
      prompt: agent.prompt,
    });
    setError("");
    setEditorOpen(true);
  };

  const openView = (agent: AgentDefinition) => {
    setViewAgent(agent);
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
        tools: form.tools,
        model: form.model || undefined,
        color: form.color || undefined,
        prompt: form.prompt.trim(),
        ...(editingAgent ? { filePath: editingAgent.filePath } : {}),
      };

      const res = await fetch("/api/agents", {
        method: editingAgent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setEditorOpen(false);
      fetchAgents();
    } catch {
      setError("Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agent: AgentDefinition) => {
    try {
      const res = await fetch(`/api/agents?filePath=${encodeURIComponent(agent.filePath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchAgents();
      }
    } catch {
      // ignore
    }
  };

  const toggleTool = (tool: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter((t) => t !== tool) : [...f.tools, tool],
    }));
  };

  const customCount = agents.filter((a) => a.source === "Custom").length;
  const pluginCount = agents.filter((a) => a.source !== "Custom").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Agents</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {customCount} custom &middot; {pluginCount} from plugins
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent-purple)] px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Agent
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
            placeholder="Search agents..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
          {(["all", "custom", "plugin"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-[10px] font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)]">
          <svg className="mb-3 h-10 w-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-[var(--text-secondary)]">
            {search ? "No agents match your search" : "No agents found"}
          </p>
          {!search && filter === "all" && (
            <button onClick={openCreate} className="mt-3 text-[10px] text-[var(--accent-purple)] hover:underline">
              Create your first agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              className="group relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
              style={{ borderLeftWidth: "3px", borderLeftColor: getColorCss(agent.color) }}
            >
              {/* Header row */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{agent.name}</h3>
                    {agent.model && (
                      <span className="shrink-0 rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                        {agent.model}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 inline-block rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                    {agent.source === "Custom" ? "Custom" : agent.source}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openView(agent)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                    title="View details"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {agent.editable && (
                    <>
                      <button
                        onClick={() => openEdit(agent)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-blue)]"
                        title="Edit"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {deleteConfirm === agent.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(agent)}
                            className="rounded-md bg-[var(--accent-red)] px-2 py-1 text-[9px] font-medium text-white"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-md bg-[var(--bg-secondary)] px-2 py-1 text-[9px] text-[var(--text-secondary)]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(agent.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-red)]"
                          title="Delete"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                {agent.description}
              </p>

              {/* Tools */}
              {agent.tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.tools.slice(0, 6).map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)]"
                    >
                      {tool}
                    </span>
                  ))}
                  {agent.tools.length > 6 && (
                    <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                      +{agent.tools.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewAgent?.name || "Agent Details"}>
        {viewAgent && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: getColorCss(viewAgent.color) }}
              />
              <span className="text-xs text-[var(--text-secondary)]">{viewAgent.source}</span>
              {viewAgent.model && (
                <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  {viewAgent.model}
                </span>
              )}
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Description</div>
              <p className="text-xs leading-relaxed text-[var(--text-primary)]">{viewAgent.description}</p>
            </div>

            {viewAgent.tools.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Tools</div>
                <div className="flex flex-wrap gap-1.5">
                  {viewAgent.tools.map((tool) => (
                    <span key={tool} className="rounded-md bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-mono text-[var(--text-primary)]">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {viewAgent.prompt && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">System Prompt</div>
                <pre className="max-h-[300px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                  {viewAgent.prompt}
                </pre>
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border)]">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">File Path</div>
              <p className="font-mono text-[10px] text-[var(--text-secondary)] break-all">{viewAgent.filePath}</p>
            </div>

            {viewAgent.editable && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setViewOpen(false); openEdit(viewAgent); }}
                  className="flex-1 rounded-lg bg-[var(--accent-blue)] py-2 text-xs font-medium text-white transition-all hover:opacity-90"
                >
                  Edit Agent
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Editor Modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingAgent ? "Edit Agent" : "Create New Agent"}
      >
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-[var(--accent-red)] bg-[#f8717110] px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Name <span className="text-[var(--accent-red)]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="my-custom-agent"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Description <span className="text-[var(--accent-red)]">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="When to trigger this agent - describe the conditions..."
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Model & Color row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Model
              </label>
              <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setForm((f) => ({ ...f, model: m.value }))}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors ${
                      form.model === m.value
                        ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Color
              </label>
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] p-2">
                {AGENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={`h-6 w-6 rounded-full transition-all ${
                      form.color === c.value ? "ring-2 ring-white/40 scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.css }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tools */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Tools ({form.tools.length} selected)
              </label>
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    tools: f.tools.length === AVAILABLE_TOOLS.length ? [] : [...AVAILABLE_TOOLS],
                  }))
                }
                className="text-[10px] text-[var(--accent-purple)] hover:underline"
              >
                {form.tools.length === AVAILABLE_TOOLS.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              {AVAILABLE_TOOLS.map((tool) => {
                const selected = form.tools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`rounded-md px-2 py-1 text-[10px] font-mono transition-all ${
                      selected
                        ? "bg-[var(--accent-purple)] text-white"
                        : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              System Prompt
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder="Instructions for what this agent should do..."
              rows={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button
              onClick={() => setEditorOpen(false)}
              className="rounded-lg px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent-purple)] px-5 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving && (
                <div className="h-3 w-3 animate-spin-slow rounded-full border border-white/30 border-t-white" />
              )}
              {editingAgent ? "Save Changes" : "Create Agent"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
