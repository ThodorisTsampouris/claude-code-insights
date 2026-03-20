"use client";

import type { TokenUsage, FileActivity } from "@/lib/types";
import { EfficiencyBadge } from "@/components/EfficiencyBadge";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function CostCard({
  totalCost,
  totalTokens,
  fileActivity,
  gitInsertions,
  gitDeletions,
}: {
  totalCost: number;
  totalTokens: TokenUsage;
  fileActivity?: FileActivity[];
  gitInsertions?: number;
  gitDeletions?: number;
}) {
  const totalInput = totalTokens.inputTokens + totalTokens.cacheCreationTokens + totalTokens.cacheReadTokens;
  const totalAll = totalInput + totalTokens.outputTokens;
  const hasFileActivity = fileActivity && fileActivity.length > 0;

  return (
    <div className="glow-green rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
      <div className="mb-1 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
        Session Cost
      </div>
      <div className="text-4xl font-bold text-[var(--accent-green)]">
        {formatCost(totalCost)}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <TokenStat label="Input" value={totalTokens.inputTokens} color="var(--accent-blue)" />
        <TokenStat label="Output" value={totalTokens.outputTokens} color="var(--accent-purple)" />
        <TokenStat label="Cache Write" value={totalTokens.cacheCreationTokens} color="var(--accent-orange)" />
        <TokenStat label="Cache Read" value={totalTokens.cacheReadTokens} color="var(--accent-yellow)" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--text-secondary)]">Total tokens</span>
        <span className="text-sm font-medium">{formatTokens(totalAll)}</span>
      </div>

      {hasFileActivity && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <EfficiencyBadge
            totalCost={totalCost}
            fileActivity={fileActivity!}
            gitInsertions={gitInsertions}
            gitDeletions={gitDeletions}
          />
        </div>
      )}
    </div>
  );
}

function TokenStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>
        {formatTokens(value)}
      </div>
    </div>
  );
}
