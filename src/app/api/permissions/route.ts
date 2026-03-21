import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");
const GLOBAL_SETTINGS = join(CLAUDE_DIR, "settings.json");

function decodeProjectPath(encoded: string): string | null {
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

function getProjectSettingsPath(projectEncoded?: string): string | null {
  if (!projectEncoded) return null;
  const projectRoot = decodeProjectPath(projectEncoded);
  if (!projectRoot) return null;
  return join(projectRoot, ".claude", "settings.local.json");
}

function readJsonSafe(path: string): Record<string, unknown> {
  try {
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

export interface PermissionRule {
  id: string;
  kind: "allow" | "ask" | "deny";
  rule: string;
  source: string;
  editable: boolean;
}

function extractRules(
  settings: Record<string, unknown>,
  source: string,
  editable: boolean
): PermissionRule[] {
  const perms = settings.permissions as Record<string, string[]> | undefined;
  if (!perms || typeof perms !== "object") return [];

  const rules: PermissionRule[] = [];
  for (const kind of ["allow", "ask", "deny"] as const) {
    const list = perms[kind];
    if (!Array.isArray(list)) continue;
    list.forEach((rule, idx) => {
      rules.push({ id: `${source}/${kind}/${idx}`, kind, rule, source, editable });
    });
  }
  return rules;
}

function getAllRules(projectEncoded?: string): PermissionRule[] {
  const all: PermissionRule[] = [];
  all.push(...extractRules(readJsonSafe(GLOBAL_SETTINGS), "Global", true));
  const projectPath = getProjectSettingsPath(projectEncoded);
  if (projectPath) {
    all.push(...extractRules(readJsonSafe(projectPath), "Project", true));
  }
  return all;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") || undefined;
  return NextResponse.json(getAllRules(project));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { kind, rule, scope, project } = body as {
      kind: "allow" | "ask" | "deny";
      rule: string;
      scope: "global" | "project";
      project?: string;
    };

    if (!["allow", "ask", "deny"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    if (!rule?.trim()) {
      return NextResponse.json({ error: "Rule is required" }, { status: 400 });
    }

    let settingsPath: string;
    if (scope === "project") {
      const projectPath = getProjectSettingsPath(project);
      if (!projectPath) {
        return NextResponse.json({ error: "No project selected" }, { status: 400 });
      }
      settingsPath = projectPath;
    } else {
      settingsPath = GLOBAL_SETTINGS;
    }

    const settings = readJsonSafe(settingsPath);
    if (!settings.permissions) settings.permissions = {};
    const perms = settings.permissions as Record<string, string[]>;
    if (!perms[kind]) perms[kind] = [];
    if (perms[kind].includes(rule.trim())) {
      return NextResponse.json({ error: "Rule already exists" }, { status: 409 });
    }
    perms[kind].push(rule.trim());

    const dir = join(settingsPath, "..");
    if (!existsSync(dir)) {
      const { mkdirSync } = await import("fs");
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save rule" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const project = searchParams.get("project") || undefined;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // id format: "Global/allow/0" or "Project/deny/2"
  const parts = id.split("/");
  if (parts.length < 3) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const source = parts[0];
  const kind = parts[1] as "allow" | "ask" | "deny";
  const index = parseInt(parts[2], 10);

  if (source !== "Global" && source !== "Project") {
    return NextResponse.json({ error: "Cannot delete this rule" }, { status: 403 });
  }

  let settingsPath: string;
  if (source === "Project") {
    const projectPath = getProjectSettingsPath(project);
    if (!projectPath) {
      return NextResponse.json({ error: "No project selected" }, { status: 400 });
    }
    settingsPath = projectPath;
  } else {
    settingsPath = GLOBAL_SETTINGS;
  }

  const settings = readJsonSafe(settingsPath);
  const perms = settings.permissions as Record<string, string[]> | undefined;

  if (!perms || !Array.isArray(perms[kind]) || perms[kind][index] === undefined) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  perms[kind].splice(index, 1);
  if (perms[kind].length === 0) delete perms[kind];

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  return NextResponse.json({ success: true });
}
