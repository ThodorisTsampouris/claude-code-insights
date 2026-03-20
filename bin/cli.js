#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, spawn } = require("child_process");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(os.homedir(), ".claude-code-insights");
const PORT = process.env.PORT || 3141;

// Handle --help and --version
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  Claude Code Insights — Real-time analytics dashboard for Claude Code sessions

  Usage:
    npx @teots/claude-code-insights [options]

  Options:
    -p, --port <port>  Port to run on (default: 3141, or PORT env var)
    -h, --help         Show this help message
    -v, --version      Show version number
    --rebuild          Force a fresh build
  `);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")
  );
  console.log(pkg.version);
  process.exit(0);
}

// Parse --port / -p flag
const portFlagIndex = args.findIndex((a) => a === "--port" || a === "-p");
const port = portFlagIndex !== -1 ? args[portFlagIndex + 1] : PORT;
const forceRebuild = args.includes("--rebuild");

// --- App setup in ~/.claude-code-insights/ ---
// npx installs the package deep inside node_modules, which breaks Next.js
// webpack resolution. Instead, we copy source files to a clean directory
// and symlink node_modules from the npx cache.

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getPackageVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")
  );
  return pkg.version;
}

function getCachedVersion() {
  const versionFile = path.join(CACHE_DIR, ".version");
  try {
    return fs.readFileSync(versionFile, "utf8").trim();
  } catch {
    return null;
  }
}

function setupApp() {
  const version = getPackageVersion();

  // Remove old source files but keep .next if version matches
  const needsFullRebuild =
    forceRebuild || getCachedVersion() !== version;

  if (needsFullRebuild && fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Copy source files
  copyDirSync(path.join(PACKAGE_ROOT, "src"), path.join(CACHE_DIR, "src"));
  for (const file of [
    "next.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "package.json",
  ]) {
    const src = path.join(PACKAGE_ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(CACHE_DIR, file));
    }
  }

  // Symlink node_modules from the npx cache so Next.js can find all deps
  const cacheNodeModules = path.join(CACHE_DIR, "node_modules");
  if (!fs.existsSync(cacheNodeModules)) {
    const hoistedNodeModules = path.dirname(
      path.dirname(require.resolve("next/package.json"))
    );
    fs.symlinkSync(hoistedNodeModules, cacheNodeModules, "dir");
  }

  // Save version marker
  fs.writeFileSync(path.join(CACHE_DIR, ".version"), version);
}

// Resolve the next binary
const nextBin = path.join(
  path.dirname(require.resolve("next/package.json")),
  "dist",
  "bin",
  "next"
);

// Set up the app directory if needed
const needsSetup =
  forceRebuild ||
  getCachedVersion() !== getPackageVersion() ||
  !fs.existsSync(CACHE_DIR);

if (needsSetup) {
  setupApp();
}

// Build if .next doesn't exist
const nextDir = path.join(CACHE_DIR, ".next");
if (!fs.existsSync(nextDir)) {
  console.log("\n  Building Claude Code Insights (first run only)...\n");
  try {
    execSync(`node "${nextBin}" build`, {
      cwd: CACHE_DIR,
      stdio: "inherit",
    });
  } catch {
    console.error("\n  Build failed. Please report this issue at:");
    console.error(
      "  https://github.com/ThodorisTsampouris/claude-code-insights/issues\n"
    );
    process.exit(1);
  }
}

// Start the server
const url = `http://localhost:${port}`;
console.log(`\n  Claude Code Insights`);
console.log(`  Ready at ${url}\n`);

const server = spawn("node", [nextBin, "start", "-p", String(port)], {
  cwd: CACHE_DIR,
  stdio: "inherit",
});

// Open browser after server has time to start
setTimeout(() => {
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    execSync(`${openCmd} ${url}`, { stdio: "ignore" });
  } catch {
    // Browser open is best-effort
  }
}, 1500);

// Graceful shutdown
function cleanup() {
  server.kill();
  process.exit();
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
