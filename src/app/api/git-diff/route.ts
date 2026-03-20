import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile as execFileCb } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { getSessionData, getClaudeDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

// Use execFile — args are passed directly to git without a shell, preventing
// any command injection from special characters in projectRoot or timestamps.
const execFile = promisify(execFileCb);

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

// Validate that a string is a well-formed git SHA-1 hash before using it
// in a git command. Prevents any crafted input from acting as a flag or ref.
function isValidGitHash(hash: string): boolean {
  return /^[0-9a-f]{40}$/i.test(hash);
}

// Validate the sessionId is a safe UUID-like string before passing to getSessionData.
function isValidSessionId(id: string): boolean {
  return /^[0-9a-f-]{1,64}$/i.test(id);
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

// Run git with argument arrays via execFile — no shell, no injection risk.
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { timeout: 5000, cwd });
  return stdout.trim();
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

  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
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

  try {
    // Get commits in the session timeframe.
    // All arguments are in an array — execFile passes them directly to git,
    // no shell expansion occurs regardless of what startTime/lastActivity contain.
    let logOutput = "";
    try {
      logOutput = await git(projectRoot, [
        "log",
        "--pretty=format:%H|%s|%aI",
        `--since=${startTime}`,
        `--until=${lastActivity}`,
      ]);
    } catch {
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

    const firstHash = commits[commits.length - 1].hash;
    const lastHash = commits[0].hash;

    // Validate hashes before using them as git arguments.
    if (!isValidGitHash(firstHash) || !isValidGitHash(lastHash)) {
      return NextResponse.json({ ...EMPTY, commits });
    }

    let stat = "";
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    try {
      // Diff from parent of first commit to last commit.
      // `${firstHash}^` is safe because firstHash has been validated as 40 hex chars.
      stat = await git(projectRoot, ["diff", `${firstHash}^`, lastHash, "--stat"]);
      const parsed = parseStat(stat);
      filesChanged = parsed.filesChanged;
      insertions = parsed.insertions;
      deletions = parsed.deletions;
    } catch {
      // Fallback: initial commit with no parent
      try {
        stat = await git(projectRoot, ["diff", firstHash, "--stat"]);
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
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      return NextResponse.json({ ...EMPTY, supported: false, error: "git not available" });
    }
    return NextResponse.json({ ...EMPTY, supported: false, error: "Git error" });
  }
}
