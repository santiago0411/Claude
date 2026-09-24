---
name: handoff
description: Save or resume unfinished work across sessions, machines and agents (Claude or Codex) through a short HANDOFF.md snapshot. Use when the user says handoff, save progress, wrap up, stop here, continue later/tomorrow, resume, or pick up where we left off, and before /clear on unfinished work.
---

# Handoff

HANDOFF.md is a snapshot of *now*, not a log. Overwrite it on every save, keep it under 60 lines
(a hook enforces that), and delete it when the task is done. History already lives in git.

## Save

1. **Commit first.** Commit finished work with a message that says what changed and why. The
   commit log is the history, so the handoff never needs to be.
2. **Overwrite** `HANDOFF.md` at the repository root with exactly this shape:

   ```markdown
   # Handoff: <task in a few words>
   Updated <YYYY-MM-DD> · branch <branch> · last commit <short sha>

   ## Goal
   <1-2 lines: what done looks like>

   ## State
   - Done: <only what a fresh session needs to orient; details are in git log>
   - In progress: <file or function, what is half-finished>

   ## Next
   1. <the concrete first action>
   2. <...>

   ## Gotchas
   - <non-obvious facts learned this session that are not in the code or CLAUDE.md>

   ## Verify
   `<command that proves the current state>`
   ```

3. **Cut before you write.** Leave out anything a fresh session gets from `git log`, the code or
   CLAUDE.md. Drop finished items. No transcripts, no file-by-file tours, no "previously...".
4. **Promote durable knowledge out of the handoff.** A rule every session needs goes into
   CLAUDE.md as one line; a rule for one area goes into `.claude/rules/` with `paths:`; a decision
   with rationale goes into `docs/decisions/NNNN-title.md`. The handoff only points to them.
5. Commit HANDOFF.md with the work-in-progress commit, so another machine can resume after
   `git pull`.
6. Tell the user it is saved and that the next step is `/clear` (or a new session) followed by
   "resume".

## Resume

1. Read `HANDOFF.md`, then run `git log --oneline -10` and `git status --short`.
2. Run the Verify command to confirm the starting state before changing anything.
3. Start on Next step 1. Read other files only when that step needs them.

## Finish

When the Goal is met, delete `HANDOFF.md` in the final commit. A stale handoff misleads the next
session more than a missing one.
