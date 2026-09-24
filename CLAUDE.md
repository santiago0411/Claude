# lean-kit (this repository)

Source for the portable Claude Code / Codex setup described in README.md.

## Commands
- Test the hooks: `node --test test/`
- Preview an install: `node install.mjs --dry-run`

## Rules
- `plugin/` and `skills/` are linked into `~/.claude`, so edits apply live; `user/` files are copied, so re-run the installer after editing them.
- `plugin/budgets.json` is the single source of the caps. When a cap changes, update the README table and the numbers quoted in `user/rules/claude-md-authoring.md` and `skills/claude-md-audit/SKILL.md`.
- Skills linked into Codex (`handoff`, `claude-md-audit`) use only Agent Skills standard frontmatter: name and description.
- Don't name a template `CLAUDE.md` or `AGENTS.md` inside this repo: Claude would load it as a nested instruction file. Use `*.template.md` or `*.global.md`.
- Hook scripts use only Node built-ins and must stay fast; they run on every Write, Edit and Stop.
