"use client";

import type { FileActivity } from "@/lib/types";

function formatCost(cost: number): string {
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function getEfficiencyLabel(costPerEdit: number): { label: string; color: string } {
  if (costPerEdit < 0.01) return { label: "Very efficient", color: "var(--accent-green)" };
  if (costPerEdit < 0.05) return { label: "Efficient", color: "var(--accent-blue)" };
  if (costPerEdit < 0.20) return { label: "Moderate", color: "var(--accent-yellow)" };
  return { label: "Expensive", color: "var(--accent-orange, #fb923c)" };
}

export function EfficiencyBadge({
  totalCost,
  fileActivity,
  gitInsertions,
  gitDeletions,
}: {
  totalCost: number;
  fileActivity: FileActivity[];
  gitInsertions?: number;
  gitDeletions?: number;
}) {
  const totalEdits = fileActivity.reduce((s, f) => s + f.edits + f.writes, 0);
  const totalReads = fileActivity.reduce((s, f) => s + f.reads, 0);
  const totalLines = (gitInsertions ?? 0) + (gitDeletions ?? 0);
  const costPerEdit = totalEdits > 0 ? totalCost / totalEdits : null;
  const costPerLine = totalLines > 0 ? totalCost / totalLines : null;

  if (totalEdits === 0) {
    return (
      <div className="text-[10px] text-[var(--text-secondary)]">
        <span className="uppercase tracking-wider">Efficiency</span>
        <div className="mt-1 text-[var(--text-secondary)]">
          Read-only session &middot; {totalReads.toLocaleString()} reads
        </div>
      </div>
    );
  }

  const { label, color } = getEfficiencyLabel(costPerEdit!);

  return (
    <div className="text-[10px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="uppercase tracking-wider text-[var(--text-secondary)]">Efficiency</span>
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1.5">
          <div className="uppercase tracking-wider text-[9px] text-[var(--text-secondary)] mb-0.5">
            Per edit
          </div>
          <div className="font-semibold text-[var(--accent-blue)]">
            {formatCost(costPerEdit!)}
          </div>
        </div>
        {costPerLine !== null ? (
          <div className="rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1.5">
            <div className="uppercase tracking-wider text-[9px] text-[var(--text-secondary)] mb-0.5">
              Per line
            </div>
            <div className="font-semibold text-[var(--accent-purple)]">
              {formatCost(costPerLine)}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1.5">
            <div className="uppercase tracking-wider text-[9px] text-[var(--text-secondary)] mb-0.5">
              Edits
            </div>
            <div className="font-semibold text-[var(--text-primary)]">
              {totalEdits}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
