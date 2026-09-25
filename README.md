# lean-kit

A portable setup for Claude Code (plus optional Codex) that keeps context small, stops instruction
files from growing without limit, and makes session handoffs short snapshots instead of logs.
The reasoning, data and sources behind every choice here: [Lean Agent Playbook](https://claude.ai/artifact/Ec2HWyqrHUL1AiSRymE5ck).

## Install

Needs git and Node.js 18+. Clone this repository anywhere, then:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1          # Windows
```

```bash
./install.sh                                                  # macOS / Linux
```

Flags: `--dry-run` shows what would change, `--codex` also sets up Codex, `--statusline` adds a
context and plan-usage meter to the terminal status line, `--uninstall` puts everything back.
Restart Claude Code afterwards (or run `/reload-plugins`).

On a new PC: clone, run the installer, done. To update: `git pull`, then run the installer again.
Anything the installer replaces is backed up to `~/.claude/backups/lean-kit-<timestamp>/`.

## What it installs

| Piece | Where | How |
|---|---|---|
| `lean-kit` plugin: budget hooks, handoff re-injection | `~/.claude/skills/lean-kit` | linked, updates with `git pull` |
| Skills: `handoff`, `claude-md-audit`, `kit-init`, `new-project` | `~/.claude/skills/` | linked |
| Global rules (`user/CLAUDE.global.md`) | `~/.claude/CLAUDE.md` | copied |
| Authoring rule for context files | `~/.claude/rules/` | copied |
| Subagents: `Explore` (Sonnet, read-only), `verifier` (Haiku) | `~/.claude/agents/` | copied |
| Settings: auto-compact at 200K, prompt suggestions off | `~/.claude/settings.json` | merged |
| With `--codex`: global `AGENTS.md` and the two portable skills | `~/.codex/`, `~/.agents/skills/` | copied / linked |

Edit files here, never the copies in `~/.claude`, then re-run the installer.

## Budgets

The hook blocks a write that leaves one of these files over its cap **and** bigger than before.
Shrinking an over-budget file is always allowed, so existing bloat can only go down.

| File | Cap (lines / words) |
|---|---|
| `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | 60 / 600 |
| `HANDOFF.md` | 60 / 500 |
| `.claude/rules/*.md` | 80 / 800 |
| `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md` | 200 / 2,000 |
| `SKILL.md` | 500 / 5,000 |
| `docs/**/*.md` | 400 / 4,000 |

Defaults live in `plugin/budgets.json`. A project can override or switch off a rule in its own
`.claude/budgets.json` (same shape; add `"off": true`).

## Daily use

- One task per session. `/clear` when the task changes; say "handoff" first if it is unfinished.
- Brand-new project: `/new-project` (scaffold, lean-kit setup, spec interview, plugin picks,
  milestone plan). Existing project: `/kit-init`, or `/claude-md-audit` where a CLAUDE.md exists.
- Both suggest plugins by matching the project's languages, dependencies and spec against the
  marketplaces registered on your machine (`skills/kit-init/scripts/suggest-plugins.mjs`). They never
  install anything.
- Before calling something done: have the `verifier` subagent run the checks.
- Watch context in the desktop app's usage ring (or the status line with `--statusline`).

## Codex (optional)

`--codex` installs the global `AGENTS.md` and links the portable skills into `~/.agents/skills`.
Then install the Codex CLI (`npm install -g @openai/codex`, `codex login`) and OpenAI's official
Claude Code plugin: `/plugin marketplace add openai/codex-plugin-cc`, then
`/plugin install codex@openai-codex`, then `/codex:setup`. It adds `/codex:review` for a
second-opinion review and `/codex:rescue` for handing a task to Codex.

## Layout

```
plugin/     lean-kit plugin: hooks.json, scripts/, budgets.json
skills/     Agent Skills standard; handoff and claude-md-audit also work in Codex
user/       files copied into ~/.claude and ~/.codex
test/       node --test test/
install.*   installer (install.mjs does the work)
```
