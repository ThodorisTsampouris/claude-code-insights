"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { DailySpending } from "@/lib/types";
import { ProjectSpending } from "./ProjectSpending";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDayColor(cost: number, maxCost: number): string {
  const ratio = cost / (maxCost || 1);
  if (ratio > 0.7) return "#f87171";
  if (ratio > 0.4) return "#fb923c";
  if (ratio > 0.2) return "#fbbf24";
  return "#4ade80";
}

interface TooltipPayload {
  payload?: DailySpending & { label: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const data = payload[0].payload;

  const projects = Object.entries(data.projectBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 shadow-lg">
      <div className="text-xs font-medium text-[var(--text-primary)] mb-1">{data.label}</div>
      <div className="flex items-center gap-3 text-[10px] mb-1.5">
        <span className="text-[var(--accent-green)] font-bold">{formatCost(data.cost)}</span>
        <span className="text-[var(--text-secondary)]">{data.sessions} sessions</span>
      </div>
      {projects.length > 0 && (
        <div className="space-y-0.5">
          {projects.map(([name, cost]) => (
            <div key={name} className="flex items-center justify-between gap-4 text-[9px]">
              <span className="text-[var(--text-secondary)] truncate max-w-[120px]">{name}</span>
              <span className="text-[var(--text-primary)]">{formatCost(cost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function SpendingSummary() {
  const [data, setData] = useState<DailySpending[]>([]);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spending?days=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
  const totalSessions = data.reduce((sum, d) => sum + d.sessions, 0);
  const maxDayCost = Math.max(...data.map((d) => d.cost), 0);
  const avgDaily = data.length > 0 ? totalCost / data.length : 0;

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold">Spending Overview</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Aggregate cost across all projects and sessions
        </p>
      </div>

      {/* Daily Spending Chart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-5">
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold text-[var(--accent-green)]">
                  {formatCost(totalCost)}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {totalSessions} sessions &middot; avg {formatCost(avgDaily)}/day
                </div>
              </div>
            </div>
            <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
              {([7, 14, 30] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1 text-[10px] font-medium transition-colors ${
                    period === p
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-[var(--text-secondary)]">
              No spending data for this period
            </div>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 9 }}
                    axisLine={{ stroke: getVar("--chart-grid") || "#2a2a3e" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: getVar("--chart-cursor") || "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="cost" radius={[3, 3, 0, 0]} maxBarSize={20}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getDayColor(entry.cost, maxDayCost)} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Spending by Project */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              Spending by Project
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Last {period} days
            </div>
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">
            {Object.keys(
              data.reduce((acc, d) => {
                for (const name of Object.keys(d.projectBreakdown)) acc[name] = true;
                return acc;
              }, {} as Record<string, boolean>)
            ).length} projects
          </div>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
          </div>
        ) : (
          <ProjectSpending data={data} />
        )}
      </div>
    </div>
  );
}
