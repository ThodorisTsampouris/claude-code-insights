import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");
const GLOBAL_SETTINGS = join(CLAUDE_DIR, "settings.json");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins", "marketplaces");

// Decode encoded project path to filesystem path (same logic as claude-md)
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

interface HookEntry {
  type: "command" | "prompt";
  command?: string;
  prompt?: string;
  timeout?: number;
}

interface HookGroup {
  hooks: HookEntry[];
  matcher?: string;
}

interface HookDefinition {
  id: string;
  event: string;
  hooks: HookEntry[];
  matcher?: string;
  source: string;
  editable: boolean;
}

function readJsonSafe(path: string): Record<string, unknown> {
  try {
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function extractHooks(
  settings: Record<string, unknown>,
  source: string,
  editable: boolean
): HookDefinition[] {
  const hooks: HookDefinition[] = [];
  const hooksObj = settings.hooks as Record<string, HookGroup[]> | undefined;
  if (!hooksObj || typeof hooksObj !== "object") return hooks;

  for (const [event, groups] of Object.entries(hooksObj)) {
    if (!Array.isArray(groups)) continue;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group || !Array.isArray(group.hooks)) continue;

      hooks.push({
        id: `${source}/${event}/${i}`,
        event,
        hooks: group.hooks.map((h: HookEntry) => ({
          type: h.type || "command",
          command: h.command,
          prompt: h.prompt,
          timeout: h.timeout,
        })),
        matcher: group.matcher,
        source,
        editable,
      });
    }
  }
  return hooks;
}

function getAllHooks(projectEncoded?: string): HookDefinition[] {
  const all: HookDefinition[] = [];

  // Global settings hooks
  all.push(...extractHooks(readJsonSafe(GLOBAL_SETTINGS), "Global", true));

  // Project settings hooks
  const projectSettings = getProjectSettingsPath(projectEncoded);
  if (projectSettings) {
    all.push(...extractHooks(readJsonSafe(projectSettings), "Project", true));
  }

  // Plugin hooks (read-only)
  if (existsSync(PLUGINS_DIR)) {
    try {
      const marketplaces = readdirSync(PLUGINS_DIR);
      for (const marketplace of marketplaces) {
        const marketplaceDir = join(PLUGINS_DIR, marketplace);
        try { if (!statSync(marketplaceDir).isDirectory()) continue; } catch { continue; }

        const plugins = readdirSync(marketplaceDir);
        for (const plugin of plugins) {
          const hooksFile = join(marketplaceDir, plugin, "hooks", "hooks.json");
          if (existsSync(hooksFile)) {
            try {
              const data = JSON.parse(readFileSync(hooksFile, "utf-8"));
              all.push(...extractHooks(data, plugin, false));
            } catch {
              continue;
            }
          }
        }
      }
    } catch {
      // plugins dir not readable
    }
  }

  return all;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") || undefined;
  return NextResponse.json(getAllHooks(project));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, hookType, command, prompt, timeout, matcher, scope, project } = body;

    if (!event) {
      return NextResponse.json({ error: "Event type is required" }, { status: 400 });
    }
    if (hookType === "command" && !command) {
      return NextResponse.json({ error: "Command is required for command hooks" }, { status: 400 });
    }
    if (hookType === "prompt" && !prompt) {
      return NextResponse.json({ error: "Prompt is required for prompt hooks" }, { status: 400 });
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

    if (!settings.hooks) settings.hooks = {};
    const hooksObj = settings.hooks as Record<string, HookGroup[]>;
    if (!hooksObj[event]) hooksObj[event] = [];

    const hookEntry: HookEntry = { type: hookType };
    if (hookType === "command") {
      hookEntry.command = command;
      if (timeout) hookEntry.timeout = parseInt(timeout, 10);
    } else {
      hookEntry.prompt = prompt;
    }

    const group: HookGroup = { hooks: [hookEntry] };
    if (matcher) group.matcher = matcher;

    hooksObj[event].push(group);

    // Ensure directory exists for project settings
    const dir = join(settingsPath, "..");
    if (!existsSync(dir)) {
      const { mkdirSync } = await import("fs");
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to create hook" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const project = searchParams.get("project") || undefined;

  if (!id) {
    return NextResponse.json({ error: "Hook id required" }, { status: 400 });
  }

  const parts = id.split("/");
  if (parts.length < 3) {
    return NextResponse.json({ error: "Invalid hook id" }, { status: 400 });
  }

  const source = parts[0];
  const event = parts.slice(1, -1).join("/");
  const index = parseInt(parts[parts.length - 1], 10);

  if (source !== "Global" && source !== "Project") {
    return NextResponse.json({ error: "Can only delete Global or Project hooks" }, { status: 403 });
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
  const hooksObj = settings.hooks as Record<string, HookGroup[]> | undefined;

  if (!hooksObj || !hooksObj[event] || !hooksObj[event][index]) {
    return NextResponse.json({ error: "Hook not found" }, { status: 404 });
  }

  hooksObj[event].splice(index, 1);
  if (hooksObj[event].length === 0) {
    delete hooksObj[event];
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  return NextResponse.json({ success: true });
}
