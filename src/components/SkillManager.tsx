"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "./Modal";
import type { SkillDefinition } from "@/lib/types";

interface FormState {
  name: string;
  description: string;
  version: string;
  content: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  version: "1.0.0",
  content: "",
};

export function SkillManager() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "custom" | "plugin">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSkill, setViewSkill] = useState<SkillDefinition | null>(null);
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchSkills = useCallback(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const filtered = skills.filter((s) => {
    if (filter === "custom" && s.source !== "Custom") return false;
    if (filter === "plugin" && s.source === "Custom") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreate = () => {
    setEditingSkill(null);
    setForm(emptyForm);
    setError("");
    setEditorOpen(true);
  };

  const openEdit = (skill: SkillDefinition) => {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      description: skill.description,
      version: skill.version || "1.0.0",
      content: skill.content,
    });
    setError("");
    setEditorOpen(true);
  };

  const openView = (skill: SkillDefinition) => {
    setViewSkill(skill);
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
        version: form.version.trim() || undefined,
        content: form.content.trim(),
        ...(editingSkill ? { filePath: editingSkill.filePath } : {}),
      };

      const res = await fetch("/api/skills", {
        method: editingSkill ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setEditorOpen(false);
      fetchSkills();
    } catch {
      setError("Failed to save skill");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skill: SkillDefinition) => {
    try {
      const res = await fetch(`/api/skills?filePath=${encodeURIComponent(skill.filePath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchSkills();
      }
    } catch {
      // ignore
    }
  };

  const customCount = skills.filter((s) => s.source === "Custom").length;
  const pluginCount = skills.filter((s) => s.source !== "Custom").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Skills</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {customCount} custom &middot; {pluginCount} from plugins
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2 text-xs font-medium text-white transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Skill
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
            placeholder="Search skills..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-blue)] focus:outline-none transition-colors"
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

      {/* Skills Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-[var(--accent-blue)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)]">
          <svg className="mb-3 h-10 w-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-xs text-[var(--text-secondary)]">
            {search ? "No skills match your search" : "No skills found"}
          </p>
          {!search && filter === "all" && (
            <button onClick={openCreate} className="mt-3 text-[10px] text-[var(--accent-blue)] hover:underline">
              Create your first skill
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="group relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
              style={{ borderLeftWidth: "3px", borderLeftColor: "var(--accent-blue)" }}
            >
              {/* Header row */}
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{skill.name}</h3>
                    {skill.version && (
                      <span className="shrink-0 rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)]">
                        v{skill.version}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 inline-block rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                    {skill.source === "Custom" ? "Custom" : skill.source}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openView(skill)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                    title="View details"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {skill.editable && (
                    <>
                      <button
                        onClick={() => openEdit(skill)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-blue)]"
                        title="Edit"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {deleteConfirm === skill.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(skill)}
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
                          onClick={() => setDeleteConfirm(skill.id)}
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
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                {skill.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewSkill?.name || "Skill Details"}>
        {viewSkill && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs text-[var(--text-secondary)]">{viewSkill.source}</span>
              {viewSkill.version && (
                <span className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)]">
                  v{viewSkill.version}
                </span>
              )}
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Description</div>
              <p className="text-xs leading-relaxed text-[var(--text-primary)]">{viewSkill.description}</p>
            </div>

            {viewSkill.content && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Content</div>
                <pre className="max-h-[300px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                  {viewSkill.content}
                </pre>
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border)]">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">File Path</div>
              <p className="font-mono text-[10px] text-[var(--text-secondary)] break-all">{viewSkill.filePath}</p>
            </div>

            {viewSkill.editable && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setViewOpen(false); openEdit(viewSkill); }}
                  className="flex-1 rounded-lg bg-[var(--accent-blue)] py-2 text-xs font-medium text-white transition-all hover:opacity-90"
                >
                  Edit Skill
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
        title={editingSkill ? "Edit Skill" : "Create New Skill"}
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
              placeholder="my-custom-skill"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-blue)] focus:outline-none transition-colors"
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
              placeholder="When Claude should use this skill - describe the trigger conditions..."
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-blue)] focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Version */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Version
            </label>
            <input
              type="text"
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="1.0.0"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-blue)] focus:outline-none transition-colors"
            />
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Skill Content (Markdown)
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="# My Skill&#10;&#10;Instructions for what this skill provides...&#10;&#10;## When to use&#10;- Condition 1&#10;- Condition 2"
              rows={12}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-blue)] focus:outline-none transition-colors resize-y"
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
              className="flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-5 py-2 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving && (
                <div className="h-3 w-3 animate-spin-slow rounded-full border border-white/30 border-t-white" />
              )}
              {editingSkill ? "Save Changes" : "Create Skill"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
