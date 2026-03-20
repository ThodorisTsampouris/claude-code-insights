"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AgentManager } from "./AgentManager";
import { SkillManager } from "./SkillManager";
import { CommandManager } from "./CommandManager";
import { HookManager } from "./HookManager";
import { ClaudeMdEditor } from "./ClaudeMdEditor";
import type { ProjectInfo } from "@/lib/types";

type ConfigTab = "claude-md" | "commands" | "agents" | "skills" | "hooks";

const TABS: { value: ConfigTab; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: "claude-md",
    label: "CLAUDE.md",
    color: "var(--accent-purple)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    value: "commands",
    label: "Commands",
    color: "var(--accent-green)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: "agents",
    label: "Agents",
    color: "var(--accent-purple)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: "skills",
    label: "Skills",
    color: "var(--accent-blue)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    value: "hooks",
    label: "Hooks",
    color: "var(--accent-orange)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function ConfigPanel() {
  const [tab, setTab] = useState<ConfigTab>("claude-md");
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProjects = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: ProjectInfo[]) => {
        setProjects(data);
        // Auto-select first project if none selected
        if (!selectedProject && data.length > 0) {
          setSelectedProject(data[0].path);
        }
      })
      .catch(() => {});
  }, [selectedProject]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  const currentProject = projects.find((p) => p.path === selectedProject);

  // Decode encoded path like "-Users-foo-bar" to "/Users/foo/bar"
  function decodePath(encoded: string): string {
    return encoded.replace(/^-/, "/").replace(/-/g, "/");
  }

  return (
    <div>
      {/* Header with project selector */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Configuration</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage your Claude Code setup
          </p>
        </div>

        {/* Project dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-card-hover)] min-w-[200px] max-w-[340px]"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-medium truncate text-[var(--text-primary)]">
                {currentProject?.name || "Select project..."}
              </div>
              {currentProject && (
                <div className="font-mono text-[9px] text-[var(--text-secondary)] truncate" title={decodePath(currentProject.path)}>
                  {decodePath(currentProject.path)}
                </div>
              )}
            </div>
            <svg
              className={`h-3 w-3 shrink-0 text-[var(--text-secondary)] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-[var(--text-secondary)]">
                  No projects found
                </div>
              ) : (
                <div className="py-1">
                  {projects.map((project) => {
                    const isSelected = selectedProject === project.path;
                    return (
                      <button
                        key={project.path}
                        onClick={() => {
                          setSelectedProject(project.path);
                          setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-[var(--accent-purple)]10 text-[var(--accent-purple)]"
                            : "text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                        }`}
                      >
                        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{project.name}</div>
                          <div className="font-mono text-[9px] text-[var(--text-secondary)] truncate" title={decodePath(project.path)}>
                            {decodePath(project.path)}
                          </div>
                        </div>
                        {isSelected && (
                          <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="mb-6 flex items-center gap-1 rounded-xl bg-[var(--bg-secondary)] p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-[10px] font-medium transition-all ${
              tab === t.value
                ? "bg-[var(--bg-card)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            style={tab === t.value ? { color: t.color } : undefined}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "claude-md" && <ClaudeMdEditor project={selectedProject || undefined} />}
      {tab === "commands" && <CommandManager />}
      {tab === "agents" && <AgentManager />}
      {tab === "skills" && <SkillManager />}
      {tab === "hooks" && <HookManager project={selectedProject || undefined} />}
    </div>
  );
}
