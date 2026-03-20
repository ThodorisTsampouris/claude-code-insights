import { NextResponse } from "next/server";
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync, mkdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");
const USER_COMMANDS_DIR = join(CLAUDE_DIR, "commands");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins", "marketplaces");

interface CommandData {
  id: string;
  name: string;
  description: string;
  argumentHint?: string;
  allowedTools?: string[];
  model?: string;
  disableModelInvocation?: boolean;
  content: string;
  source: string;
  filePath: string;
  editable: boolean;
}

function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string | string[]> = {};
  const lines = match[1].split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      meta[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { meta, body: match[2].trim() };
}

function buildCommandFile(cmd: {
  description: string;
  argumentHint?: string;
  allowedTools?: string[];
  model?: string;
  disableModelInvocation?: boolean;
}, content: string): string {
  let fm = "---\n";
  fm += `description: ${cmd.description}\n`;
  if (cmd.argumentHint) fm += `argument-hint: ${cmd.argumentHint}\n`;
  if (cmd.allowedTools && cmd.allowedTools.length > 0) {
    fm += `allowed-tools: [${cmd.allowedTools.map((t) => `"${t}"`).join(", ")}]\n`;
  }
  if (cmd.model) fm += `model: ${cmd.model}\n`;
  if (cmd.disableModelInvocation !== undefined) {
    fm += `disable-model-invocation: ${cmd.disableModelInvocation}\n`;
  }
  fm += "---\n\n";
  fm += content;
  return fm;
}

function scanCommandsDir(dir: string, source: string, editable: boolean): CommandData[] {
  const commands: CommandData[] = [];
  if (!existsSync(dir)) return commands;

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;
        const raw = readFileSync(filePath, "utf-8");
        const { meta, body } = parseFrontmatter(raw);
        const name = basename(file, ".md");

        commands.push({
          id: `${source}/${name}`,
          name,
          description: (meta.description as string) || "",
          argumentHint: (meta["argument-hint"] as string) || undefined,
          allowedTools: Array.isArray(meta["allowed-tools"]) ? meta["allowed-tools"] : undefined,
          model: (meta.model as string) || undefined,
          disableModelInvocation: meta["disable-model-invocation"] === "true" ? true :
            meta["disable-model-invocation"] === "false" ? false : undefined,
          content: body,
          source,
          filePath,
          editable,
        });
      } catch {
        continue;
      }
    }
  } catch {
    // dir not readable
  }
  return commands;
}

function getAllCommands(): CommandData[] {
  const commands: CommandData[] = [];

  // User commands (editable)
  commands.push(...scanCommandsDir(USER_COMMANDS_DIR, "Custom", true));

  // Plugin commands (read-only)
  if (existsSync(PLUGINS_DIR)) {
    try {
      const marketplaces = readdirSync(PLUGINS_DIR);
      for (const marketplace of marketplaces) {
        const marketplaceDir = join(PLUGINS_DIR, marketplace);
        try {
          if (!statSync(marketplaceDir).isDirectory()) continue;
        } catch { continue; }

        const plugins = readdirSync(marketplaceDir);
        for (const plugin of plugins) {
          const commandsDir = join(marketplaceDir, plugin, "commands");
          commands.push(...scanCommandsDir(commandsDir, plugin, false));
        }
      }
    } catch {
      // plugins dir not readable
    }
  }

  return commands;
}

export async function GET() {
  return NextResponse.json(getAllCommands());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, argumentHint, allowedTools, model, disableModelInvocation, content } = body;

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }

    if (!existsSync(USER_COMMANDS_DIR)) {
      mkdirSync(USER_COMMANDS_DIR, { recursive: true });
    }

    const filename = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const filePath = join(USER_COMMANDS_DIR, `${filename}.md`);
    if (existsSync(filePath)) {
      return NextResponse.json({ error: "A command with this name already exists" }, { status: 409 });
    }

    const fileContent = buildCommandFile(
      { description, argumentHint, allowedTools, model, disableModelInvocation },
      content || ""
    );
    writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json({ success: true, id: `Custom/${filename}` });
  } catch {
    return NextResponse.json({ error: "Failed to create command" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { filePath, description, argumentHint, allowedTools, model, disableModelInvocation, content } = body;

    if (!filePath || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const resolved = join(USER_COMMANDS_DIR, basename(filePath));
    if (!resolved.startsWith(USER_COMMANDS_DIR)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!existsSync(resolved)) {
      return NextResponse.json({ error: "Command not found" }, { status: 404 });
    }

    const fileContent = buildCommandFile(
      { description, argumentHint, allowedTools, model, disableModelInvocation },
      content || ""
    );
    writeFileSync(resolved, fileContent, "utf-8");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update command" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("filePath");

  if (!filePath) {
    return NextResponse.json({ error: "filePath required" }, { status: 400 });
  }

  const resolved = join(USER_COMMANDS_DIR, basename(filePath));
  if (!resolved.startsWith(USER_COMMANDS_DIR)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!existsSync(resolved)) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  try {
    unlinkSync(resolved);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete command" }, { status: 500 });
  }
}
