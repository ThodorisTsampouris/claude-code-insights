import { NextResponse } from "next/server";
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync, mkdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");
const USER_AGENTS_DIR = join(CLAUDE_DIR, "agents");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins", "marketplaces");

interface AgentData {
  id: string;
  name: string;
  description: string;
  tools: string[];
  model?: string;
  color?: string;
  prompt: string;
  source: string;
  filePath: string;
  editable: boolean;
}

function parseFrontmatter(content: string): { meta: Record<string, string | string[]>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

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
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (value === "" && i + 1 < lines.length && lines[i + 1]?.startsWith("  -")) {
      const arr: string[] = [];
      while (i + 1 < lines.length && lines[i + 1]?.startsWith("  -")) {
        i++;
        arr.push(lines[i].replace(/^\s*-\s*/, "").trim());
      }
      meta[key] = arr;
    } else {
      meta[key] = value;
    }
  }

  return { meta, body: match[2].trim() };
}

function buildFrontmatter(agent: { name: string; description: string; tools: string[]; model?: string; color?: string }, prompt: string): string {
  let fm = "---\n";
  fm += `name: ${agent.name}\n`;
  fm += `description: ${agent.description}\n`;
  if (agent.tools.length > 0) {
    fm += `tools: [${agent.tools.join(", ")}]\n`;
  }
  if (agent.model) fm += `model: ${agent.model}\n`;
  if (agent.color) fm += `color: ${agent.color}\n`;
  fm += "---\n\n";
  fm += prompt;
  return fm;
}

function scanDirectory(dir: string, source: string, editable: boolean): AgentData[] {
  const agents: AgentData[] = [];
  if (!existsSync(dir)) return agents;

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;
        const content = readFileSync(filePath, "utf-8");
        const { meta, body } = parseFrontmatter(content);

        agents.push({
          id: `${source}/${basename(file, ".md")}`,
          name: (meta.name as string) || basename(file, ".md"),
          description: (meta.description as string) || "",
          tools: Array.isArray(meta.tools) ? meta.tools : [],
          model: (meta.model as string) || undefined,
          color: (meta.color as string) || undefined,
          prompt: body,
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
  return agents;
}

function getAllAgents(): AgentData[] {
  const agents: AgentData[] = [];

  // User agents (editable)
  agents.push(...scanDirectory(USER_AGENTS_DIR, "Custom", true));

  // Plugin agents (read-only)
  if (existsSync(PLUGINS_DIR)) {
    try {
      const marketplaces = readdirSync(PLUGINS_DIR);
      for (const marketplace of marketplaces) {
        const marketplaceDir = join(PLUGINS_DIR, marketplace);
        try {
          const stat = statSync(marketplaceDir);
          if (!stat.isDirectory()) continue;
        } catch { continue; }

        const plugins = readdirSync(marketplaceDir);
        for (const plugin of plugins) {
          const agentsDir = join(marketplaceDir, plugin, "agents");
          agents.push(...scanDirectory(agentsDir, plugin, false));
        }
      }
    } catch {
      // plugins dir not readable
    }
  }

  return agents;
}

export async function GET() {
  const agents = getAllAgents();
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, tools, model, color, prompt } = body;

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }

    // Ensure user agents directory exists
    if (!existsSync(USER_AGENTS_DIR)) {
      mkdirSync(USER_AGENTS_DIR, { recursive: true });
    }

    // Create safe filename
    const filename = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const filePath = join(USER_AGENTS_DIR, `${filename}.md`);

    if (existsSync(filePath)) {
      return NextResponse.json({ error: "An agent with this name already exists" }, { status: 409 });
    }

    const content = buildFrontmatter({ name, description, tools: tools || [], model, color }, prompt || "");
    writeFileSync(filePath, content, "utf-8");

    return NextResponse.json({ success: true, id: `Custom/${filename}` });
  } catch {
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { filePath, name, description, tools, model, color, prompt } = body;

    if (!filePath || !name || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: only allow editing files in the user agents directory
    const resolved = join(USER_AGENTS_DIR, basename(filePath));
    if (!resolved.startsWith(USER_AGENTS_DIR)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!existsSync(resolved)) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const content = buildFrontmatter({ name, description, tools: tools || [], model, color }, prompt || "");
    writeFileSync(resolved, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("filePath");

  if (!filePath) {
    return NextResponse.json({ error: "filePath required" }, { status: 400 });
  }

  // Security: only allow deleting files in the user agents directory
  const resolved = join(USER_AGENTS_DIR, basename(filePath));
  if (!resolved.startsWith(USER_AGENTS_DIR)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!existsSync(resolved)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    unlinkSync(resolved);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
