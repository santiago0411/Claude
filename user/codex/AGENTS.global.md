# Global working rules (every repository)

- One task per session; start a new session when the task changes.
- Search (rg) before reading, and read only the relevant ranges. Skip generated folders
  (Library/, node_modules/, bin/, obj/, dist/).
- Don't create new markdown files (reports, summaries, plans) unless asked; put summaries in the
  final message.
- If HANDOFF.md exists at the repository root, read it before starting. When asked to hand off,
  overwrite it as a snapshot under 60 lines (goal, state, next steps, gotchas, verify command);
  never append. History belongs in commit messages.
- Before saying a task is done, run the repository's verify command and report the result.
- When a task is delegated from Claude Code: stay inside the stated scope, don't refactor
  unrelated code, and finish with at most 15 lines covering files changed, commands run, results
  and open questions.
