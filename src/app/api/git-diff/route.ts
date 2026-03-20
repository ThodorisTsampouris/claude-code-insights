import { NextResponse } from "next/server";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { getSessionData, getClaudeDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

const exec = promisify(execCb);

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  time: string;
}

interface GitDiffResponse {
  supported: boolean;
  error?: string;
  commits: GitCommit[];
  stat: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

function isPathSafe(projectPath: string): boolean {
  const projectsBase = resolve(join(getClaudeDir(), "projects"));
  const resolved = resolve(join(projectsBase, projectPath));
  return resolved.startsWith(projectsBase + "/") || resolved === projectsBase;
}

/** Decode encoded project path to real filesystem path (handles dashes in folder names). */
function decodeProjectRoot(encoded: string): string | null {
  const naive = encoded.replace(/^-/, "/").replace(/-/g, "/");
  if (existsSync(naive)) return naive;

  const parts = encoded.replace(/^-/, "").split("-");
  let current = "/";
  let i = 0;

  while (i < parts.length) {
    let found = false;
    for (let j = parts.length; j > i; j--) {
      const candidate = join(current, parts.slice(i, j).join("-"));
      if (existsSync(candidate)) {
        current = candidate;
        i = j;
        found = true;
        break;
      }
    }
    if (!found) {
      current = join(current, parts[i]);
      i++;
    }
  }

  return existsSync(current) ? current : null;
}

function parseStat(stat: string): { filesChanged: number; insertions: number; deletions: number } {
  const match = stat.match(
    /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
  );
  if (!match) return { filesChanged: 0, insertions: 0, deletions: 0 };
  return {
    filesChanged: parseInt(match[1] || "0", 10),
    insertions: parseInt(match[2] || "0", 10),
    deletions: parseInt(match[3] || "0", 10),
  };
}

const EMPTY: GitDiffResponse = {
  supported: true,
  commits: [],
  stat: "",
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get("project");
  const sessionId = searchParams.get("session");

  if (!projectPath || !sessionId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  if (!isPathSafe(projectPath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const projectRoot = decodeProjectRoot(projectPath);
  if (!projectRoot) {
    return NextResponse.json({ ...EMPTY, supported: false, error: "Project directory not found" });
  }

  // Get session times
  const sessionData = getSessionData(projectPath, sessionId);
  if (!sessionData) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { startTime, lastActivity } = sessionData;
  if (!startTime || !lastActivity) {
    return NextResponse.json(EMPTY);
  }

  const opts = { timeout: 5000, cwd: projectRoot };

  try {
    // Get commits in the session timeframe
    const logCmd = `git -C "${projectRoot}" log --pretty=format:"%H|%s|%aI" --since="${startTime}" --until="${lastActivity}"`;
    let logOutput = "";
    try {
      const { stdout } = await exec(logCmd, opts);
      logOutput = stdout.trim();
    } catch {
      // Check if it's a "not a git repo" error
      return NextResponse.json({ ...EMPTY, supported: false, error: "Not a git repository" });
    }

    if (!logOutput) {
      return NextResponse.json(EMPTY);
    }

    const commits: GitCommit[] = logOutput
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, message, time] = line.split("|");
        return {
          hash: hash || "",
          shortHash: (hash || "").slice(0, 7),
          message: message || "",
          time: time || "",
        };
      });

    if (commits.length === 0) {
      return NextResponse.json(EMPTY);
    }

    // Get diff stat between first and last commit
    const firstHash = commits[commits.length - 1].hash;
    const lastHash = commits[0].hash;

    let stat = "";
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    try {
      // Try diff from parent of first commit to last commit
      const { stdout } = await exec(
        `git -C "${projectRoot}" diff ${firstHash}^..${lastHash} --stat`,
        opts,
      );
      stat = stdout.trim();
      const parsed = parseStat(stat);
      filesChanged = parsed.filesChanged;
      insertions = parsed.insertions;
      deletions = parsed.deletions;
    } catch {
      // Fallback: initial commit (no parent)
      try {
        const { stdout } = await exec(
          `git -C "${projectRoot}" diff ${firstHash} --stat`,
          opts,
        );
        stat = stdout.trim();
        const parsed = parseStat(stat);
        filesChanged = parsed.filesChanged;
        insertions = parsed.insertions;
        deletions = parsed.deletions;
      } catch {
        // Can't get diff, still return commits
      }
    }

    return NextResponse.json({
      supported: true,
      commits,
      stat,
      filesChanged,
      insertions,
      deletions,
    } satisfies GitDiffResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // ENOENT means git not installed
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      return NextResponse.json({ ...EMPTY, supported: false, error: "git not available" });
    }
    return NextResponse.json({ ...EMPTY, supported: false, error: "Git error" });
  }
}
