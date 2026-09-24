# Global working rules (every project)

## Context is the budget
- One task per session. When a task is finished or the topic changes, say so and suggest /clear; for unfinished work, run the handoff skill first.
- Search before reading: Grep or Glob first, then Read only the relevant range. Don't re-read a file already read this session unless it changed or the context was compacted.
- Send broad codebase exploration to the Explore subagent and build/test runs with long output to the verifier subagent. Bring back conclusions, not dumps.
- Don't open generated or vendored folders (Library/, node_modules/, bin/, obj/, dist/), large logs or images unless the task needs them. Crop or downscale screenshots before reading them.

## Files and docs
- Don't create new markdown files (reports, summaries, plans, notes) unless asked. Put summaries in the chat.
- HANDOFF.md is a snapshot under 60 lines: overwrite it, never append. History belongs in commit messages.
- Put durable knowledge where it loads least often: every-session rule, one line in CLAUDE.md; one-area rule, .claude/rules/ with paths:; procedure, a skill; rationale and history, docs/.
- A lean-kit hook blocks context files from growing past their caps. When blocked, compress or relocate; never work around it with shell writes.

## Done means verified
- Before saying a task is done, run the project's verify command (build, tests, lint) and show the decisive result. If you couldn't verify, say so plainly.
- After two failed attempts at the same fix, stop and summarize what you learned instead of trying a third variation.

## Second opinions
- If the codex plugin is installed, offer /codex:review before merging large or risky changes. Don't delegate to Codex without the user asking.
