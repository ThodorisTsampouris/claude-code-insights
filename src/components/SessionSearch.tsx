"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SearchResult {
  sessionId: string;
  projectPath: string;
  projectName: string;
  excerpt: string;
  timestamp: string;
  matchCount: number;
}

function timeAgo(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SessionSearch({
  onSelectSession,
}: {
  onSelectSession: (projectPath: string, sessionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResults(data);
        else setResults([]);
        setSearched(true);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setSearched(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
        setSearched(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExpand = () => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      setSearched(false);
      setExpanded(false);
    }
  };

  const handleSelect = (r: SearchResult) => {
    onSelectSession(r.projectPath, r.sessionId);
    setQuery("");
    setResults([]);
    setSearched(false);
    setExpanded(false);
  };

  const showDropdown = expanded && (results.length > 0 || (searched && query.length >= 2));

  if (!expanded) {
    return (
      <div className="mb-3">
        <button
          onClick={handleExpand}
          title="Search sessions"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mb-3 relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5">
        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search sessions..."
          className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none min-w-0"
        />
        {loading ? (
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-[var(--accent-purple)] border-t-transparent" />
        ) : query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-[var(--text-secondary)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {results.map((r) => (
                <button
                  key={`${r.projectPath}/${r.sessionId}`}
                  onClick={() => handleSelect(r)}
                  className="w-full px-3 py-2.5 text-left hover:bg-[var(--bg-card-hover)] border-b border-[var(--border)] last:border-b-0 transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                      {r.projectName}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.matchCount > 1 && (
                        <span className="text-[9px] text-[var(--accent-blue)]">
                          {r.matchCount} matches
                        </span>
                      )}
                      <span className="text-[9px] text-[var(--text-secondary)]">
                        {timeAgo(r.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-secondary)] mb-1">
                    {r.sessionId.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                    {r.excerpt}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
