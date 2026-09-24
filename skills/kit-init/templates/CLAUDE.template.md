# <Project name>
<!-- lean-kit template. Hard cap 200 lines / 2,000 words (hook-enforced); aim for about 120 lines.
     Every line must prevent a real mistake. HTML comments like this one are stripped before
     Claude sees the file, so they cost no context. Delete sections that stay empty. -->

<One line: what this is and the stack.>

## Commands
- Build: `<command>`
- Test, targeted: `<command for one test or one file>`
- Test, all: `<command>`
- Lint / typecheck: `<command>`
- Run locally: `<command>`

## Done means
- `<verify command>` passes. For UI changes: <how to check it visually>.

## Rules that differ from defaults
<!-- One line each. Add the reason only when the alternative looks attractive enough to be proposed again. -->
- <rule>

## Gotchas
<!-- Non-obvious behavior that fails silently: code that looks right but is not. -->
- <gotcha>

## Where to look
<!-- Only pointers the code does not make obvious. Details live in docs/, one topic per file. -->
- <area>: `<path>`; details in `docs/<topic>.md`

## Compact instructions
When compacting, keep: files modified, commands that failed and why, and the current plan step.
