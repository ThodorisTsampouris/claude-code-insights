"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ProjectInfo, SessionData } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";
import { useBudget } from "@/lib/useBudget";
import { useBookmarks } from "@/lib/useBookmarks";
import { useGitDiff } from "@/lib/useGitDiff";
import { CostCard } from "@/components/CostCard";
import { CostChart } from "@/components/CostChart";
import { ModelBreakdown } from "@/components/ModelBreakdown";
import { ToolUsage } from "@/components/ToolUsage";
import { AgentPanel } from "@/components/AgentPanel";
import { SessionPicker } from "@/components/SessionPicker";
import { SessionSearch } from "@/components/SessionSearch";
import { ConversationTimeline } from "@/components/ConversationTimeline";
import { FileHeatmap } from "@/components/FileHeatmap";
import { CostPerTurnChart } from "@/components/CostPerTurn";
import { SpendingSummary } from "@/components/SpendingSummary";
import { LiveFeed } from "@/components/LiveFeed";
import { MissionControl } from "@/components/MissionControl";
import { BudgetSettings } from "@/components/BudgetSettings";
import { BudgetBadge } from "@/components/BudgetBadge";
import { ContextBar } from "@/components/ContextBar";
import { ConfigPanel } from "@/components/ConfigPanel";
import { CopyResumeButton } from "@/components/CopyResumeButton";
import { ExportButton } from "@/components/ExportButton";
import { GitDiffPanel } from "@/components/GitDiffPanel";

type Tab = "session" | "spending" | "live" | "budget" | "config";

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [session, setSession] = useState<SessionData | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("session");
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);

  const { theme, toggle: toggleTheme } = useTheme();
  const { config: budgetConfig, setConfig: setBudgetConfig, status: budgetStatus, loading: budgetLoading } = useBudget();
  const { bookmarks, toggleBookmark } = useBookmarks();
  const { data: gitData, loading: gitLoading } = useGitDiff(selectedProject, selectedSession);

  // Keep track of selected project/session across refreshes
  const selectedRef = useRef({ project: selectedProject, session: selectedSession });
  selectedRef.current = { project: selectedProject, session: selectedSession };

  // Fetch project list - reusable
  const fetchProjects = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: ProjectInfo[]) => {
        setProjects(data);
        // Auto-select first session only on initial load (no selection yet)
        if (data.length > 0 && data[0].sessions.length > 0 && !selectedRef.current.project) {
          setSelectedProject(data[0].path);
          setSelectedSession(data[0].sessions[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initial project list fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-refresh project list every 5 seconds to detect new sessions
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchProjects]);

  const fetchSession = useCallback(() => {
    if (!selectedProject || !selectedSession) return;
    fetch(`/api/sessions?project=${encodeURIComponent(selectedProject)}&session=${encodeURIComponent(selectedSession)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSession(data);
      })
      .catch(() => {});
  }, [selectedProject, selectedSession]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSession]);

  const handleSelect = (projectPath: string, sessionId: string) => {
    setSelectedProject(projectPath);
    setSelectedSession(sessionId);
    setActiveTab("session");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 mx-auto animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
          <p className="text-sm text-[var(--text-secondary)]">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] p-4 flex flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-tight">
              <span className="text-[var(--accent-purple)]">Claude Code</span>{" "}
              <span className="text-[var(--text-primary)]">Insights</span>
            </h1>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Session analytics dashboard
            </p>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mb-4 flex flex-wrap rounded-lg bg-[var(--bg-primary)] p-0.5">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === "live"
                ? "bg-[var(--bg-card)] text-[var(--accent-green)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setActiveTab("session")}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === "session"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Session
          </button>
          <button
            onClick={() => setActiveTab("spending")}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === "spending"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Spend
          </button>
          <button
            onClick={() => setActiveTab("budget")}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === "budget"
                ? "bg-[var(--bg-card)] text-[var(--accent-orange)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Budget
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === "config"
                ? "bg-[var(--bg-card)] text-[var(--accent-purple)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Config
          </button>
        </div>

        {/* Auto-refresh toggle */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-[var(--bg-primary)] px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            Live refresh
          </span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              autoRefresh ? "bg-[var(--accent-green)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                autoRefresh ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>

        {/* Budget alert badge */}
        {budgetStatus.alerts.length > 0 && (
          <div className="mb-4">
            <BudgetBadge status={budgetStatus} onClick={() => setActiveTab("budget")} />
          </div>
        )}

        {/* Session search */}
        <SessionSearch onSelectSession={handleSelect} />

        <div className="flex-1 overflow-hidden">
          <SessionPicker
            projects={projects}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            onSelect={handleSelect}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            showOnlyBookmarked={showOnlyBookmarked}
            onToggleFilter={() => setShowOnlyBookmarked((v) => !v)}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "live" ? (
          <MissionControl
            onSelectSession={(projectPath, sessionId) => {
              setSelectedProject(projectPath);
              setSelectedSession(sessionId);
              setActiveTab("session");
            }}
          />
        ) : activeTab === "spending" ? (
          <SpendingSummary monthlyBudget={budgetConfig.monthly} />
        ) : activeTab === "budget" ? (
          <BudgetSettings
            config={budgetConfig}
            status={budgetStatus}
            loading={budgetLoading}
            onConfigChange={setBudgetConfig}
          />
        ) : activeTab === "config" ? (
          <ConfigPanel />
        ) : !session ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Select a session to view insights
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{session.projectName}</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Session {session.sessionId.slice(0, 8)} &middot;{" "}
                  {session.messageCount} messages &middot;{" "}
                  {new Date(session.startTime).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExportButton session={session} size="md" />
                <CopyResumeButton sessionId={session.sessionId} projectRoot={session.projectRoot} size="md" />
                {autoRefresh && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
                    <span className="text-[10px] text-[var(--text-secondary)]">Live</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 1: Cost + Cost Over Time */}
            <div className="mb-5 grid grid-cols-12 gap-5">
              <div className="col-span-4">
                <CostCard
                  totalCost={session.totalCost}
                  totalTokens={session.totalTokens}
                  fileActivity={session.fileActivity}
                  gitInsertions={gitData?.insertions}
                  gitDeletions={gitData?.deletions}
                />
              </div>
              <div className="col-span-8 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="mb-3 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Cost Over Time
                </div>
                <div className="h-48">
                  <CostChart data={session.costOverTime} />
                </div>
              </div>
            </div>

            {/* Row 2: Context Window */}
            {session.contextSnapshots.length > 0 && (
              <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <ContextBar
                  snapshots={session.contextSnapshots}
                  compactions={session.compactions}
                  contextLimit={session.contextLimit}
                />
              </div>
            )}

            {/* Row 3: Conversation Timeline */}
            <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                Conversation Timeline
              </div>
              <ConversationTimeline events={session.timeline} />
            </div>

            {/* Row 4: Cost Per Turn */}
            <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                Cost Per Turn
              </div>
              <CostPerTurnChart turns={session.costPerTurn} />
            </div>

            {/* Row 5: Model + Tools */}
            <div className="mb-5 grid grid-cols-12 gap-5">
              <div className="col-span-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="mb-4 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Model Breakdown
                </div>
                <ModelBreakdown breakdown={session.modelBreakdown} />
              </div>
              <div className="col-span-7 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="mb-4 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Tool Usage
                </div>
                <ToolUsage usage={session.toolUsage} />
              </div>
            </div>

            {/* Row 6: File Heatmap */}
            <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  File Activity
                </div>
                {session.fileActivity.length > 0 && (
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {session.fileActivity.length} files touched
                  </span>
                )}
              </div>
              <FileHeatmap files={session.fileActivity} />
            </div>

            {/* Row 7: Git Activity */}
            {session.projectRoot && (
              <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="mb-4 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Git Activity
                </div>
                <GitDiffPanel data={gitData} loading={gitLoading} />
              </div>
            )}

            {/* Row 8: Agents */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Agents
                </div>
                {session.agents.filter((a) => a.status === "running").length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
                    <span className="text-[10px] text-[var(--accent-green)]">
                      {session.agents.filter((a) => a.status === "running").length} active
                    </span>
                  </div>
                )}
              </div>
              <AgentPanel agents={session.agents} />
            </div>
          </>
        )}
      </div>

      {/* Live Feed overlay */}
      <LiveFeed
        projectPath={selectedProject}
        sessionId={selectedSession}
        session={session}
      />
    </div>
  );
}
