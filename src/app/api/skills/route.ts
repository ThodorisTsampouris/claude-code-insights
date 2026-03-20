import { NextResponse } from "next/server";
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync, mkdirSync, statSync, rmSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const CLAUDE_DIR = join(homedir(), ".claude");
const USER_SKILLS_DIR = join(CLAUDE_DIR, "skills");
const PLUGINS_DIR = join(CLAUDE_DIR, "plugins", "marketplaces");

interface SkillData {
  id: string;
  name: string;
  description: string;
  version?: string;
  content: string;
  source: string;
  filePath: string;
  editable: boolean;
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    meta[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
  }

  return { meta, body: match[2].trim() };
}

function buildSkillFile(skill: { name: string; description: string; version?: string }, content: string): string {
  let fm = "---\n";
  fm += `name: ${skill.name}\n`;
  fm += `description: ${skill.description}\n`;
  if (skill.version) fm += `version: ${skill.version}\n`;
  fm += "---\n\n";
  fm += content;
  return fm;
}

function scanSkillsDirectory(dir: string, source: string, editable: boolean): SkillData[] {
  const skills: SkillData[] = [];
  if (!existsSync(dir)) return skills;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const entryPath = join(dir, entry);
      try {
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          // Look for SKILL.md inside directory
          const skillFile = join(entryPath, "SKILL.md");
          if (existsSync(skillFile)) {
            const raw = readFileSync(skillFile, "utf-8");
            const { meta, body } = parseFrontmatter(raw);
            skills.push({
              id: `${source}/${entry}`,
              name: meta.name || entry,
              description: meta.description || "",
              version: meta.version || undefined,
              content: body,
              source,
              filePath: skillFile,
              editable,
            });
          }
        } else if (entry.endsWith(".md")) {
          // Direct .md skill file
          const raw = readFileSync(entryPath, "utf-8");
          const { meta, body } = parseFrontmatter(raw);
          skills.push({
            id: `${source}/${basename(entry, ".md")}`,
            name: meta.name || basename(entry, ".md"),
            description: meta.description || "",
            version: meta.version || undefined,
            content: body,
            source,
            filePath: entryPath,
            editable,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // dir not readable
  }
  return skills;
}

function getAllSkills(): SkillData[] {
  const skills: SkillData[] = [];

  // User skills (editable)
  skills.push(...scanSkillsDirectory(USER_SKILLS_DIR, "Custom", true));

  // Plugin skills (read-only)
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
          const skillsDir = join(marketplaceDir, plugin, "skills");
          skills.push(...scanSkillsDirectory(skillsDir, plugin, false));
        }
      }
    } catch {
      // plugins dir not readable
    }
  }

  return skills;
}

export async function GET() {
  const skills = getAllSkills();
  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, version, content } = body;

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }

    const dirName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const skillDir = join(USER_SKILLS_DIR, dirName);

    if (existsSync(skillDir)) {
      return NextResponse.json({ error: "A skill with this name already exists" }, { status: 409 });
    }

    mkdirSync(skillDir, { recursive: true });

    const fileContent = buildSkillFile({ name, description, version }, content || "");
    writeFileSync(join(skillDir, "SKILL.md"), fileContent, "utf-8");

    return NextResponse.json({ success: true, id: `Custom/${dirName}` });
  } catch {
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { filePath, name, description, version, content } = body;

    if (!filePath || !name || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security: only allow editing files in the user skills directory
    if (!filePath.startsWith(USER_SKILLS_DIR)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const fileContent = buildSkillFile({ name, description, version }, content || "");
    writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("filePath");

  if (!filePath) {
    return NextResponse.json({ error: "filePath required" }, { status: 400 });
  }

  // Security: only allow deleting in the user skills directory
  if (!filePath.startsWith(USER_SKILLS_DIR)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  try {
    // If it's a SKILL.md inside a directory, remove the whole directory
    if (filePath.endsWith("SKILL.md")) {
      const dir = join(filePath, "..");
      rmSync(dir, { recursive: true, force: true });
    } else {
      unlinkSync(filePath);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete skill" }, { status: 500 });
  }
}
