"use client";

import { useEffect, useState } from "react";
import type { GitDiffResponse } from "@/lib/types";

export function useGitDiff(
  projectPath: string | null,
  sessionId: string | null,
): { data: GitDiffResponse | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<GitDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath || !sessionId) {
      setData(null);
      return;
    }

    setLoading(true);
    setData(null);
    setError(null);

    fetch(
      `/api/git-diff?project=${encodeURIComponent(projectPath)}&session=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.supported !== undefined) {
          setData(d);
        } else if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load git data");
        setLoading(false);
      });
  }, [projectPath, sessionId]);

  return { data, loading, error };
}
