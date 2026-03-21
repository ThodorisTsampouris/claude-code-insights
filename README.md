# Claude Code Insights

A real-time analytics dashboard for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions. Track spending, monitor token usage, analyze tool activity, search conversations, and watch live sessions — all from a local web UI with no external services.

[![npm version](https://img.shields.io/npm/v/@teots/claude-code-insights)](https://www.npmjs.com/package/@teots/claude-code-insights)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![Claude Code Insights Dashboard](docs/images/dashboard.png)

## Quick Start

```bash
npx @teots/claude-code-insights
```

That's it. The first run builds the dashboard (~30s), then opens it in your browser. Subsequent runs start instantly.

### Options

```bash
npx @teots/claude-code-insights --port 8080   # custom port (default: 3141)
npx @teots/claude-code-insights --rebuild      # force a fresh build
npx @teots/claude-code-insights --help         # show all options
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and used at least once (so `~/.claude/projects/` exists)
- `git` in your `PATH` (optional — required for the Git Activity panel)

## Features

### Session Analytics
- **Cost tracking** — cumulative cost chart per session with model-level breakdown
- **Token usage** — input, output, cache read, and cache write token counts
- **Token efficiency score** — cost per file edit and cost per line changed (with git), rated Very efficient / Efficient / Moderate / Expensive
- **Model breakdown** — see which models (Opus, Sonnet, Haiku) were used and their cost share
- **Tool usage** — bar chart of tool calls (Read, Edit, Write, Bash, Grep, Glob, Agent, etc.)
- **Cost per turn** — see how much each user prompt cost to process
- **File heatmap** — which files were read, edited, and written most
- **Conversation timeline** — visual timeline of user messages, assistant responses, and tool calls
- **Agent panel** — track sub-agents spawned during a session with their individual costs and full prompts
- **Context window** — real-time progress bar showing how full the context is, with compaction markers
- **Compaction insights** — see when compactions happened, how many tokens were freed, and context usage over time
- **Git activity** — commits made during the session, files changed, lines inserted/deleted, and a collapsible diff stat (requires git)

### Session Actions
- **Resume session** — copy `cd <project> && claude --resume <id>` to clipboard with one click, from the session header, sidebar, or Mission Control
- **Export as Markdown** — download the full conversation as a `.md` file including user prompts, tool calls, cost per turn, and file activity table
- **Bookmark sessions** — star any session to pin it to the top of the list; filter to show only starred sessions; bookmarks persist to `~/.claude/insights-bookmarks.json`

### Session Search
- **Full-text search** — search across all session conversations with a debounced search bar in the sidebar
- Results show project name, session ID, time, excerpt with match context, and match count
- Click any result to navigate directly to that session

### Mission Control
- **Live monitoring** — real-time view of all active Claude Code sessions across projects
- **Unified activity feed** — see user messages, tool calls, and agent spawns as they happen
- **Multi-session overview** — cost and status at a glance for every running session
- **Resume from live view** — copy the resume command directly from any active session card

### Spending Overview
- **Daily spending chart** — aggregate costs over time (7 / 14 / 30 day windows)
- **Monthly forecast** — projected end-of-month spend based on daily average, with days remaining and budget comparison
- **Project breakdown** — per-project cost bars with percentage share of total spend
- **Session and token totals** — daily summaries of sessions, tokens, and spend

### Budget Management
- **Spending limits** — set daily, weekly, and monthly budgets
- **Visual progress meters** — see how close you are to each limit at a glance
- **Browser notifications** — get alerted when spending hits a configurable threshold (default 90%) or exceeds the budget
- **Warning threshold slider** — customize when you want to be notified (50%–99%)
- **Persistent config** — budget settings are saved to `~/.claude/insights-config.json` so they survive browser clears and restarts

### Configuration
Manage your Claude Code setup from within the dashboard — no manual file editing required.

- **CLAUDE.md editor** — create and edit project root, `.claude/`, and global instruction files with syntax highlighting, line numbers, and Cmd+S to save
- **Commands** — browse, create, and delete custom slash commands (project and global)
- **Agents** — manage sub-agent definitions with tool access controls and a select-all toggle
- **Skills** — view and manage skill definitions available to Claude
- **Hooks** — build event-driven hooks (PreToolUse, PostToolUse, Stop, etc.) with command or prompt types, optional matchers, and project/global scope
- **Permissions** — view and manage allow / ask / deny tool permission rules across global and project scopes, with one-click delete and quick-add from common rule templates
- **Project selector** — switch between projects to edit their specific configuration

### Appearance
- **Dark / Light mode** — toggle between themes with the sun/moon button in the sidebar
- Theme preference is persisted in localStorage

## How It Works

Claude Code stores session logs as `.jsonl` files in `~/.claude/projects/`. This dashboard reads those logs directly from disk — no API keys, no external services, no data leaves your machine.

The parser extracts messages, token usage, tool calls, and cost data from each session log. Costs are calculated locally using Anthropic's published pricing. Git data is read by running `git` commands in your project directory.

## Development

If you prefer to clone and run from source:

```bash
git clone https://github.com/ThodorisTsampouris/claude-code-insights.git
cd claude-code-insights
npm install
npm run dev
```

Open [http://localhost:3141](http://localhost:3141) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3141`  | Port the dashboard runs on (also via `--port` flag) |

## Persistent Data

The dashboard writes two small JSON files to `~/.claude/`:

| File | Purpose |
|------|---------|
| `insights-config.json` | Budget limits, notification threshold, enable/disable flag |
| `insights-bookmarks.json` | Starred session IDs |

Both files are human-readable and can be deleted at any time to reset to defaults.

When installed via `npx`, the dashboard caches its build in `~/.claude-code-insights/`. You can safely delete this directory — it will be rebuilt on the next run.

## Tech Stack

- [Next.js](https://nextjs.org/) 15 with Turbopack
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Recharts](https://recharts.org/) for data visualization
- [Chokidar](https://github.com/paulmillr/chokidar) for file watching
- TypeScript

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Main dashboard
│   ├── layout.tsx              # Root layout
│   └── api/
│       ├── sessions/route.ts   # Session list & detail
│       ├── spending/route.ts   # Aggregate spending
│       ├── active/route.ts     # Active sessions
│       ├── search/route.ts     # Full-text session search
│       ├── git-diff/route.ts   # Git activity for a session
│       ├── bookmarks/route.ts  # Bookmark read/write
│       ├── budget/route.ts     # Budget config read/write
│       ├── agents/route.ts     # Agent definitions CRUD
│       ├── skills/route.ts     # Skill definitions CRUD
│       ├── commands/route.ts   # Slash commands CRUD
│       ├── hooks/route.ts      # Hooks CRUD (global & project)
│       ├── permissions/route.ts # Permission rules CRUD (global & project)
│       └── claude-md/route.ts  # CLAUDE.md read/write
├── lib/
│   ├── parser.ts               # JSONL log parsing & analysis
│   ├── pricing.ts              # Model pricing & cost calculation
│   ├── types.ts                # Shared TypeScript types
│   ├── useTheme.ts             # Dark/light theme hook
│   ├── useBudget.ts            # Budget management hook
│   ├── useBookmarks.ts         # Bookmark state & persistence hook
│   └── useGitDiff.ts           # Git diff fetch hook
└── components/
    ├── CostCard.tsx            # Session cost + token stats + efficiency
    ├── CostChart.tsx           # Cost over time line chart
    ├── CostPerTurn.tsx         # Per-turn cost bar chart
    ├── CostForecast.tsx        # Monthly spend projection
    ├── EfficiencyBadge.tsx     # Cost-per-edit / cost-per-line metric
    ├── ModelBreakdown.tsx      # Model distribution chart
    ├── ToolUsage.tsx           # Tool call frequency chart
    ├── SessionPicker.tsx       # Sidebar session list with bookmarks
    ├── SessionSearch.tsx       # Full-text search bar + results
    ├── SpendingSummary.tsx     # Aggregate daily/project spending
    ├── ProjectSpending.tsx     # Project cost breakdown bars
    ├── ConversationTimeline.tsx# Message/tool/agent timeline
    ├── FileHeatmap.tsx         # File activity table
    ├── GitDiffPanel.tsx        # Git commits + diff stat for session
    ├── AgentPanel.tsx          # Sub-agent detail cards
    ├── LiveFeed.tsx            # Floating real-time activity overlay
    ├── MissionControl.tsx      # Multi-session live monitoring
    ├── BudgetSettings.tsx      # Budget input + meters + alerts
    ├── BudgetBadge.tsx         # Sidebar budget alert badge
    ├── BookmarkButton.tsx      # Star icon for session bookmarking
    ├── CopyResumeButton.tsx    # Copy resume command to clipboard
    ├── ExportButton.tsx        # Export session as Markdown
    ├── ContextBar.tsx          # Context window progress bar
    ├── Modal.tsx               # Reusable modal dialog
    ├── ConfigPanel.tsx         # Config tab switcher
    ├── ClaudeMdEditor.tsx      # CLAUDE.md code editor
    ├── CommandManager.tsx      # Slash command CRUD UI
    ├── AgentManager.tsx        # Agent definition CRUD UI
    ├── SkillManager.tsx        # Skill definition viewer
    ├── HookManager.tsx         # Hook definition editor
    └── PermissionManager.tsx   # Permission rules CRUD UI
```

## Privacy

All data stays on your machine. The dashboard reads Claude Code's local session logs and performs all calculations within your local Next.js instance. The only external process invoked is `git` in your own project directories. Nothing is sent to any external service.

## License

MIT
