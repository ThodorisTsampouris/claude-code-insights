"use client";

export function BookmarkButton({
  starred,
  onToggle,
}: {
  starred: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          onToggle(e as unknown as React.MouseEvent);
      }}
      title={starred ? "Remove bookmark" : "Bookmark this session"}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--accent-yellow)]"
    >
      {starred ? (
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: "var(--accent-yellow)" }}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      )}
    </div>
  );
}
