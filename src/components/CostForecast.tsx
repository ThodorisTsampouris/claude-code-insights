"use client";

import type { DailySpending } from "@/lib/types";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function CostForecast({
  data,
  monthlyBudget,
}: {
  data: DailySpending[];
  monthlyBudget?: number | null;
}) {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // "YYYY-MM"
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const daysRemaining = daysInMonth - now.getDate();

  const currentMonthData = data.filter((d) => d.date.startsWith(currentMonth));
  const currentMonthSpend = currentMonthData.reduce((s, d) => s + d.cost, 0);

  if (currentMonthData.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-5">
        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Monthly Forecast
        </div>
        <p className="text-sm text-[var(--text-secondary)]">No spend this month yet.</p>
      </div>
    );
  }

  const avgPerDay = currentMonthSpend / daysElapsed;
  const projectedTotal = avgPerDay * daysInMonth;
  const progressPct = Math.min(100, (currentMonthSpend / projectedTotal) * 100);

  let budgetPct: number | null = null;
  let overBudget = false;
  if (monthlyBudget && monthlyBudget > 0) {
    budgetPct = (projectedTotal / monthlyBudget) * 100;
    overBudget = projectedTotal > monthlyBudget;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
          Monthly Forecast
        </div>
        {budgetPct !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              overBudget
                ? "bg-red-500/10 text-red-400"
                : "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
            }`}
          >
            {overBudget ? "Over budget" : "On track"}
          </span>
        )}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div
          className="text-3xl font-bold"
          style={{ color: overBudget ? "#f87171" : "var(--accent-green)" }}
        >
          {formatCost(projectedTotal)}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] pb-1">
          projected this month
        </div>
      </div>

      <div className="text-[10px] text-[var(--text-secondary)] mb-4">
        {formatCost(currentMonthSpend)} spent &middot; {formatCost(avgPerDay)}/day avg &middot;{" "}
        {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
      </div>

      {/* Progress: current spend vs projected */}
      <div className="mb-1 flex items-center justify-between text-[9px] text-[var(--text-secondary)]">
        <span>Current</span>
        <span>{formatCost(currentMonthSpend)} of {formatCost(projectedTotal)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progressPct}%`,
            backgroundColor: "var(--accent-blue)",
          }}
        />
      </div>

      {/* Budget comparison */}
      {monthlyBudget && monthlyBudget > 0 && (
        <>
          <div className="mb-1 flex items-center justify-between text-[9px] text-[var(--text-secondary)]">
            <span>vs Budget ({formatCost(monthlyBudget)})</span>
            <span>{Math.round(budgetPct ?? 0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, budgetPct ?? 0)}%`,
                backgroundColor: overBudget ? "#f87171" : "#4ade80",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
