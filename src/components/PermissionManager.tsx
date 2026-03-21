"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "./Modal";

type RuleKind = "allow" | "ask" | "deny";

interface PermissionRule {
  id: string;
  kind: RuleKind;
  rule: string;
  source: string;
  editable: boolean;
}

const KIND_CONFIG: Record<RuleKind, { label: string; color: string; desc: string; icon: React.ReactNode }> = {
  allow: {
    label: "Allow",
    color: "var(--accent-green)",
    desc: "Tools that run without asking for confirmation",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  ask: {
    label: "Ask",
    color: "var(--accent-yellow)",
    desc: "Tools that always prompt for confirmation",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  deny: {
    label: "Deny",
    color: "var(--accent-red)",
    desc: "Tools that are always blocked",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

const RULE_EXAMPLES = [
  "Bash(npm run:*)",
  "Bash(git commit:*)",
  "Bash(git push:*)",
  "Edit(**/*.ts)",
  "Edit(**/*.json)",
  "Read(**/*)",
  "Bash(rm:*)",
  "Bash(curl:*)",
];

interface FormState {
  kind: RuleKind;
  rule: string;
  scope: "global" | "project";
}

const emptyForm: FormState = { kind: "allow", rule: "", scope: "global" };

export function PermissionManager({ project }: { project?: string }) {
  const [rules, setRules] = useState<PermissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedKind, setExpandedKind] = useState<RuleKind | null>("allow");

  const fetchRules = useCallback(() => {
    const params = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/api/permissions${params}`)
      .then((r) => r.json())
      .then((data) => { setRules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const grouped = (["allow", "ask", "deny"] as RuleKind[]).map((kind) => ({
    kind,
    rules: rules.filter((r) => r.kind === kind),
  }));

  const openCreate = (kind?: RuleKind) => {
    setForm({ ...emptyForm, kind: kind || "allow" });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.rule.trim()) { setError("Rule is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: form.kind, rule: form.rule.trim(), scope: form.scope, project }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setModalOpen(false);
      setExpandedKind(form.kind);
      fetchRules();
    } catch {
      setError("Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: PermissionRule) => {
    try {
      const params = new URLSearchParams({ id: rule.id });
      if (project) params.set("project", project);
      const res = await fetch(`/api/permissions?${params}`, { method: "DELETE" });
      if (res.ok) { setDeleteConfirm(null); fetchRules(); }
    } catch { /* ignore */ }
  };

  const totalRules = rules.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Permissions</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {totalRules} rule{totalRules !== 1 ? "s" : ""} &middot; allow / ask / deny
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent-green)] px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Rule
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-green)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ kind, rules: kindRules }) => {
            const cfg = KIND_CONFIG[kind];
            const isExpanded = expandedKind === kind;

            return (
              <div key={kind} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                {/* Kind header */}
                <button
                  onClick={() => setExpandedKind(isExpanded ? null : kind)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md shrink-0" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{cfg.label}</span>
                      {kindRules.length > 0 && (
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>
                          {kindRules.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">{cfg.desc}</p>
                  </div>
                  <svg
                    className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded rules */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
                    {kindRules.length === 0 ? (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">No {kind} rules</span>
                        <button
                          onClick={() => openCreate(kind)}
                          className="text-[10px] font-medium hover:underline"
                          style={{ color: cfg.color }}
                        >
                          Add rule
                        </button>
                      </div>
                    ) : (
                      <>
                        {kindRules.map((r) => (
                          <div
                            key={r.id}
                            className="group/rule flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2.5"
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="font-mono text-[11px] text-[var(--text-primary)] break-all">{r.rule}</span>
                              <span className="shrink-0 rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                                {r.source}
                              </span>
                            </div>

                            {r.editable && (
                              <div className="shrink-0 opacity-0 group-hover/rule:opacity-100 transition-opacity">
                                {deleteConfirm === r.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDelete(r)} className="rounded-md bg-[var(--accent-red)] px-2 py-1 text-[9px] font-medium text-white">Delete</button>
                                    <button onClick={() => setDeleteConfirm(null)} className="rounded-md bg-[var(--bg-card)] px-2 py-1 text-[9px] text-[var(--text-secondary)]">Cancel</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(r.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--accent-red)]"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => openCreate(kind)}
                          className="mt-1 text-[10px] font-medium hover:underline"
                          style={{ color: cfg.color }}
                        >
                          + Add another rule
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

      {/* Create Rule Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Permission Rule">
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-[var(--accent-red)] bg-[#f8717110] px-3 py-2 text-xs text-[var(--accent-red)]">{error}</div>
          )}

          {/* Kind */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Type <span className="text-[var(--accent-red)]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["allow", "ask", "deny"] as RuleKind[]).map((k) => {
                const cfg = KIND_CONFIG[k];
                const selected = form.kind === k;
                return (
                  <button
                    key={k}
                    onClick={() => setForm((f) => ({ ...f, kind: k }))}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all ${
                      selected ? "ring-1 bg-[var(--bg-secondary)]" : "bg-[var(--bg-secondary)] opacity-50 hover:opacity-80"
                    }`}
                    style={selected ? { outlineColor: cfg.color, outlineWidth: "1px", outlineStyle: "solid", outlineOffset: "-1px", borderRadius: "0.5rem" } : undefined}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <span className="text-[10px] font-medium" style={selected ? { color: cfg.color } : undefined}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Rule <span className="text-[var(--accent-red)]">*</span>
            </label>
            <input
              type="text"
              value={form.rule}
              onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="Bash(npm run:*)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-green)] focus:outline-none transition-colors"
              style={{ borderColor: form.rule ? KIND_CONFIG[form.kind].color : undefined }}
            />
            <p className="mt-1 text-[9px] text-[var(--text-secondary)]">
              Use <code className="rounded bg-[var(--bg-secondary)] px-1">Tool(pattern)</code> syntax. Wildcards: <code className="rounded bg-[var(--bg-secondary)] px-1">*</code>
            </p>

            {/* Examples */}
            <div className="mt-2 flex flex-wrap gap-1">
              {RULE_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setForm((f) => ({ ...f, rule: ex }))}
                  className="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[9px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                >
                  {ex}
                </button>
              ))}
            </div>
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
            <div className="mt-1.5 rounded-md bg-[var(--bg-secondary)] px-2.5 py-1.5">
              <div className="font-mono text-[9px] text-[var(--text-secondary)] truncate">
                {form.scope === "global"
                  ? "~/.claude/settings.json"
                  : project
                    ? `${project.replace(/^-/, "/").replace(/-/g, "/")}/.claude/settings.local.json`
                    : "No project selected"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: KIND_CONFIG[form.kind].color }}
            >
              {saving && <div className="h-3 w-3 animate-spin-slow rounded-full border border-white/30 border-t-white" />}
              Add Rule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
