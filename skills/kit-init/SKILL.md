---
name: kit-init
description: Set up the current project for lean agent work - a lean CLAUDE.md with real commands, read-deny rules for generated folders, gitignore entries and stack-specific plugin suggestions.
disable-model-invocation: true
---

# Set up this project for lean-kit

Work in the repository root. Show the user a short plan of what you will create or change, and
wait for approval before writing anything.

## 1. Detect the stack

Look only at root-level markers and one level down: `package.json` (Node; `next.config.*` means
Next.js), `*.sln` or `*.csproj` (.NET), `ProjectSettings/ProjectVersion.txt` or a folder containing
it (Unity), `pyproject.toml`, `go.mod`, `Cargo.toml`. A repository can have several.

## 2. CLAUDE.md

- If a CLAUDE.md (or AGENTS.md) exists, do not replace it. Run the claude-md-audit skill on it.
- Otherwise, start from `${CLAUDE_SKILL_DIR}/templates/CLAUDE.template.md`. Fill every command by reading
  `package.json` scripts, the solution file or the Unity setup, then run each command once to
  confirm it works before writing it down. Delete template sections that stay empty.
- Prefer quiet output flags in commands (for example `dotnet test --nologo -v q`,
  `npx vitest run --reporter=dot`), so verification does not flood the context.
- If the user also uses Codex here, put the shared rules in AGENTS.md and make CLAUDE.md
  `@AGENTS.md` followed by Claude-only lines. Use the import, not a symlink, on Windows.

## 3. Read-deny generated folders

Merge the entries for each detected stack from `${CLAUDE_SKILL_DIR}/templates/deny-by-stack.json`
into `permissions.deny` in `.claude/settings.json` (create the file if needed, keep existing keys).
These folders are large, generated, and never the right place to read.

## 4. gitignore

Make sure `.gitignore` contains `CLAUDE.local.md` and `.claude/settings.local.json`. Do not ignore
`HANDOFF.md`: it is committed so another machine can resume.

## 5. Suggest plugins, do not install

Run `node "${CLAUDE_SKILL_DIR}/scripts/suggest-plugins.mjs" --dir .`, adding `--terms "a,b"` for
services the project uses that its files don't show. It matches the project's languages,
dependencies and marker files against the marketplaces registered on this machine and skips
installed plugins. Present at most five picks, best first, each with its reason and what it adds
to every session; say when a language server binary is missing and how to install it. The user
installs from `/plugin`.

## 6. Report

List the files created or changed, and the line and word counts of CLAUDE.md against its caps
(200 lines / 2,000 words hard, about 120 lines as a target).
