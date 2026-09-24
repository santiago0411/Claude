---
paths:
  - "**/CLAUDE.md"
  - "**/CLAUDE.local.md"
  - "**/.claude/rules/*.md"
  - "**/AGENTS.md"
  - "**/HANDOFF.md"
---

# Writing agent instruction files

Applies when adding to, trimming or reviewing CLAUDE.md, AGENTS.md, a rules file or HANDOFF.md.
Sources: [memory](https://code.claude.com/docs/en/memory), [best practices](https://code.claude.com/docs/en/best-practices).

## Budget

Anthropic: target under 200 lines per CLAUDE.md; longer files consume more context and reduce
adherence. lean-kit enforces hard caps (200 lines / 2,000 words for CLAUDE.md, 80 / 800 per rule,
60 / 500 for HANDOFF.md). Measure words too, since dense lines hide size: `wc -l -w <file>`.

## The test for every line

**Would removing this cause a mistake?** If not, cut it. Include: commands Claude can't guess,
rules that differ from defaults, test instructions, repo etiquette, project-specific architecture
decisions, environment quirks, non-obvious gotchas. Exclude: anything derivable from the code,
standard conventions, API docs (link instead), fast-changing information, tutorials, file-by-file
tours, self-evident advice. Repository overviews measurably don't help (ETH Zurich, 2026).

## Rule stays, story moves

A rule changes what gets done; the story behind it only convinces. Pay for convincing on demand
from `docs/`, not in every session. Keep the why inline only when the rejected alternative is
attractive enough to be proposed again, or when the failure was silent (the code looks fine but
behaves wrong). Sharpest check: would a competent person who doesn't know the history propose the
old thing? Dates age badly inline; in `docs/` they read as a changelog.

## Route content by how it must reach the agent

| Destination | Behavior | Use for |
|---|---|---|
| `CLAUDE.md` | every session | rules that break something when ignored |
| `.claude/rules/*.md` + `paths:` | injected when a matching file is read | rules for one area |
| skill | loaded on demand | multi-step procedures |
| `docs/*.md` | only when opened; advisory | mechanism, rationale, history |
| `HANDOFF.md` | read at resume | current task state only, overwritten |
| hook | always, deterministic | anything that must happen with zero exceptions |

Path-scoped rules fire on reading a matching file and are summarized away by compaction until one
matches again. For a constraint that must hold while creating files from scratch, use a skill or
one line in CLAUDE.md.

## Before finishing an edit

- Scan for contradictions across sections and nested files; check claims about the repo against
  `git ls-files`, not the prose.
- One line per rule, claim first, reason after.
- Be concrete enough to verify: "run `dotnet test AO_BackEnd.sln` before committing", not "test
  your changes".
- If a rule must hold with zero exceptions and is mechanically checkable, make it a hook.
