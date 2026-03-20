import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

interface SearchResult {
  sessionId: string;
  projectPath: string;
  projectName: string;
  excerpt: string;
  timestamp: string;
  matchCount: number;
}

function getClaudeDir(): string {
  return join(homedir(), ".claude");
}

function decodeProjectName(encoded: string): string {
  const decoded = encoded.replace(/^-/, "/").replace(/-/g, "/");
  const parts = decoded.split("/").filter(Boolean);
  return parts[parts.length - 1] || encoded;
}

function buildExcerpt(content: string, query: string): string {
  const lower = content.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lower.indexOf(lowerQ);
  if (idx === -1) return content.slice(0, 120);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + lowerQ.length + 60);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return prefix + content.slice(start, end) + suffix;
}

function extractTextContent(raw: Record<string, unknown>): string | null {
  // Check raw.message.content (array of blocks)
  const msg = raw.message as Record<string, unknown> | undefined;
  if (msg && Array.isArray(msg.content)) {
    const texts = (msg.content as Record<string, unknown>[])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string);
    if (texts.length > 0) return texts.join(" ");
  }
  // Check raw.content (string, for user messages)
  if (typeof raw.content === "string" && raw.content.trim()) {
    return raw.content;
  }
  return null;
}

function getTimestamp(raw: Record<string, unknown>): string {
  if (typeof raw.timestamp === "string") return raw.timestamp;
  const msg = raw.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.created_at === "number")
    return new Date(msg.created_at * 1000).toISOString();
  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(20, parseInt(searchParams.get("limit") || "20", 10));

  if (q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const lowerQ = q.toLowerCase();
  const projectsDir = join(getClaudeDir(), "projects");
  const results: SearchResult[] = [];

  if (!existsSync(projectsDir)) {
    return NextResponse.json([]);
  }

  let projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(projectsDir);
  } catch {
    return NextResponse.json([]);
  }

  outer: for (const dir of projectDirs) {
    const dirPath = join(projectsDir, dir);
    let files: string[] = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = basename(file, ".jsonl");
      const filePath = join(dirPath, file);
      let lines: string[] = [];
      try {
        lines = readFileSync(filePath, "utf-8").split("\n");
      } catch {
        continue;
      }

      let matchCount = 0;
      let firstExcerpt = "";
      let firstTimestamp = "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(line);
        } catch {
          continue;
        }

        const type = raw.type as string;
        if (type !== "user" && type !== "assistant") continue;

        const content = extractTextContent(raw);
        if (!content) continue;

        if (content.toLowerCase().includes(lowerQ)) {
          matchCount++;
          if (matchCount === 1) {
            firstExcerpt = buildExcerpt(content, q);
            firstTimestamp = getTimestamp(raw);
          }
        }
      }

      if (matchCount > 0) {
        results.push({
          sessionId,
          projectPath: dir,
          projectName: decodeProjectName(dir),
          excerpt: firstExcerpt,
          timestamp: firstTimestamp,
          matchCount,
        });
        if (results.length >= limit) break outer;
      }
    }
  }

  results.sort((a, b) => {
    if (b.timestamp && a.timestamp) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return b.matchCount - a.matchCount;
  });

  return NextResponse.json(results);
}
