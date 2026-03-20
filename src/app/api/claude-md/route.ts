import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");

interface ClaudeMdFile {
  path: string;
  location: "project-root" | "project-claude" | "global";
  label: string;
  content: string;
  exists: boolean;
}

// Decode the encoded project directory name back to a real filesystem path
// e.g. "-Users-foo-my-project" -> "/Users/foo/my-project"
// This is lossy because dashes in dir names are indistinguishable from path separators.
// We validate by checking if the decoded path exists on disk.
function decodeProjectPath(encoded: string): string | null {
  // The encoding replaces "/" with "-" and prepends "-" for root.
  // We try progressively: start from the full replacement, then try to
  // find the longest existing path by selectively keeping dashes.
  const naive = encoded.replace(/^-/, "/").replace(/-/g, "/");
  if (existsSync(naive)) return naive;

  // Try a smarter decode: walk segments and find the longest valid prefix
  const parts = encoded.replace(/^-/, "").split("-");
  let current = "/";
  let i = 0;

  while (i < parts.length) {
    // Try combining this part with the next ones (to handle dashes in names)
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
      // Fall back to naive single segment
      current = join(current, parts[i]);
      i++;
    }
  }

  return existsSync(current) ? current : null;
}

function getClaudeMdFiles(projectEncoded?: string): ClaudeMdFile[] {
  const files: ClaudeMdFile[] = [];

  // Resolve project root from encoded path
  if (projectEncoded) {
    const projectRoot = decodeProjectPath(projectEncoded);

    if (projectRoot) {
      // Project root CLAUDE.md
      const projectRootPath = join(projectRoot, "CLAUDE.md");
      files.push({
        path: projectRootPath,
        location: "project-root",
        label: `Project Root`,
        content: existsSync(projectRootPath) ? readFileSync(projectRootPath, "utf-8") : "",
        exists: existsSync(projectRootPath),
      });

      // Project .claude/CLAUDE.md
      const projectClaudePath = join(projectRoot, ".claude", "CLAUDE.md");
      files.push({
        path: projectClaudePath,
        location: "project-claude",
        label: `Project .claude/`,
        content: existsSync(projectClaudePath) ? readFileSync(projectClaudePath, "utf-8") : "",
        exists: existsSync(projectClaudePath),
      });
    }
  }

  // Global ~/.claude/CLAUDE.md (always shown)
  const globalPath = join(CLAUDE_DIR, "CLAUDE.md");
  files.push({
    path: globalPath,
    location: "global",
    label: "Global (~/.claude/)",
    content: existsSync(globalPath) ? readFileSync(globalPath, "utf-8") : "",
    exists: existsSync(globalPath),
  });

  return files;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") || undefined;
  return NextResponse.json(getClaudeMdFiles(project));
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { path, content, project } = body;

    if (!path || content === undefined) {
      return NextResponse.json({ error: "Path and content required" }, { status: 400 });
    }

    // Build list of allowed paths
    const allowedPaths = [join(CLAUDE_DIR, "CLAUDE.md")];

    if (project) {
      const projectRoot = decodeProjectPath(project);
      if (projectRoot) {
        allowedPaths.push(join(projectRoot, "CLAUDE.md"));
        allowedPaths.push(join(projectRoot, ".claude", "CLAUDE.md"));
      }
    }

    if (!allowedPaths.includes(path)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Ensure parent directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
