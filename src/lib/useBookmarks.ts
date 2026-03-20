"use client";

import { useEffect, useState, useCallback } from "react";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bookmarks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.bookmarks)) setBookmarks(data.bookmarks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleBookmark = useCallback((sessionId: string) => {
    setBookmarks((prev) => {
      const starred = !prev.includes(sessionId);
      const next = starred
        ? [...prev, sessionId]
        : prev.filter((id) => id !== sessionId);
      // Fire and forget
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, starred }),
      }).catch(() => {});
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (sessionId: string) => bookmarks.includes(sessionId),
    [bookmarks],
  );

  return { bookmarks, toggleBookmark, isBookmarked, loading };
}
