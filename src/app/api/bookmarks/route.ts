import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const BOOKMARKS_PATH = join(homedir(), ".claude", "insights-bookmarks.json");

function readBookmarks(): string[] {
  try {
    if (existsSync(BOOKMARKS_PATH)) {
      const raw = readFileSync(BOOKMARKS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.bookmarks)) return parsed.bookmarks;
    }
  } catch {}
  return [];
}

function writeBookmarks(bookmarks: string[]) {
  writeFileSync(BOOKMARKS_PATH, JSON.stringify({ bookmarks }, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json({ bookmarks: readBookmarks() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, starred } = body;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const current = readBookmarks();

    let updated: string[];
    if (starred) {
      updated = current.includes(sessionId) ? current : [...current, sessionId];
    } else {
      updated = current.filter((id) => id !== sessionId);
    }

    writeBookmarks(updated);
    return NextResponse.json({ bookmarks: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update bookmarks" }, { status: 500 });
  }
}
