---
name: claude-md-audit
description: Audit and trim agent context files (CLAUDE.md, AGENTS.md, .claude/rules, HANDOFF.md, agent-facing docs) for bloat, contradictions and content that belongs elsewhere. Use when asked to review, shrink, clean up or write one, when the lean-kit budget hook blocks a write, or when instructions in one are being ignored.
---

# Audit a context file

Instruction files rot in one direction: every session adds, none subtract. This is the
subtraction pass. The authoring rules are in `~/.claude/rules/claude-md-authoring.md`, which loads
when a CLAUDE.md is read; read it if it is not already in context.

Why it matters, with sources: Anthropic says to keep each CLAUDE.md under 200 lines because longer
files consume more context and reduce adherence. An ETH Zurich study (Gloaguen et al., 2026) found
that context files generally did not raise task success but added over 20% to inference cost, and
that repository overviews did not help; instructions about non-standard practices were followed.

## 1. Measure

```bash
wc -l -w CLAUDE.md
awk '/^#+ /{s=$0; next} {if(s!="")w[s]+=NF} END{for(k in w) print w[k], k}' CLAUDE.md | sort -rn
```

Budgets live in the lean-kit plugin's `budgets.json` (project overrides in `.claude/budgets.json`).
Hard caps for a project CLAUDE.md are 200 lines and 2,000 words; aim for about 120 lines. One
section is usually most of the file, and that is where the work is.

## 2. Inventory what already exists

Before proposing a destination, look: `ls docs/ .claude/rules/ .claude/skills/`. Read the docs that
exist rather than judging them by line count. If a doc already says what CLAUDE.md restates, the fix
is deleting the duplicate, not writing more.

## 3. Classify every bullet

Against the include/exclude table and the "rule stays, story moves" test in the authoring rules,
sort each into: **keep** / **move to docs/** / **move to a path-scoped rule** / **move to a skill**
/ **delete as derivable from the code**.

Then check separately, because these are bugs rather than bloat:

- Contradictions between sections, and against nested CLAUDE.md or AGENTS.md files.
- Stale claims about the repo: verify with `git ls-files` and the code, not the prose.
- Rules whose subject no longer exists: a renamed method, a deleted class, a moved path.

For HANDOFF.md, anything finished goes (it is in git), and it is rewritten in the snapshot shape
from the handoff skill. For docs over budget, split by topic and archive finished plans.

## 4. Report before editing

Present what moves where and why, with the measurements and the specific keep/drop calls, and wait
for approval. The author usually disagrees with two or three calls, and that disagreement is
information: they know which decisions get re-proposed.

## 5. Execute

- Move text verbatim where possible. This is relocation, not rewriting, and the diff stays
  reviewable.
- New docs get a one-line pointer from CLAUDE.md.
- Path-scoped rules need `paths:` frontmatter that matches a real file; check the glob.
- Nothing may be lost: after moving, grep the new locations for each dropped rule.
- Re-measure and report before and after.

## Watch for

- `.claude/settings.local.json` being swept into a commit. It is per-machine consent.
- Path-scoped rules are Claude Code only. If a constraint must reach Codex or humans, it also needs
  a home in AGENTS.md or docs/.
- Do not delete history, relocate it. It is often why a rule survives review.
