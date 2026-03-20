"use client";

import type { DailySpending } from "@/lib/types";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function getBarColor(ratio: number): string {
  if (ratio > 0.7) return "var(--accent-red)";
  if (ratio > 0.4) return "var(--accent-orange)";
  if (ratio > 0.2) return "var(--accent-yellow)";
  return "var(--accent-green)";
}

interface ProjectData {
  name: string;
  cost: number;
  sessions: Set<string>;
}

export function ProjectSpending({ data }: { data: DailySpending[] }) {
  // Aggregate spending by project across all days
  const projectMap = new Map<string, ProjectData>();

  for (const day of data) {
    for (const [name, cost] of Object.entries(day.projectBreakdown)) {
      const existing = projectMap.get(name) || { name, cost: 0, sessions: new Set<string>() };
      existing.cost += cost;
      // Count the date as a session-day
      existing.sessions.add(day.date);
      projectMap.set(name, existing);
    }
  }

  const projects = Array.from(projectMap.values())
    .sort((a, b) => b.cost - a.cost);

  if (projects.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-[var(--text-secondary)]">
        No project spending data
      </div>
    );
  }

  const maxCost = projects[0]?.cost || 1;
  const totalCost = projects.reduce((sum, p) => sum + p.cost, 0);

  return (
    <div className="space-y-2">
      {projects.map((project, i) => {
        const pct = (project.cost / maxCost) * 100;
        const shareOfTotal = ((project.cost / totalCost) * 100).toFixed(1);
        const barColor = getBarColor(project.cost / maxCost);

        return (
          <div key={project.name} className="group">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-[var(--text-secondary)] w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--text-primary)] truncate">
                  {project.name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {shareOfTotal}%
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>
                  {formatCost(project.cost)}
                </span>
              </div>
            </div>
            <div className="ml-6 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: barColor,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
