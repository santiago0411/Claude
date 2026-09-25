---
name: new-project
description: Start a new application the lean way - scaffold with the official generator, set up lean-kit, interview the user into a short spec, and split it into session-sized milestones. No feature code in this session.
disable-model-invocation: true
---

# Start a new project

One session, four outputs: a scaffolded repository, a lean CLAUDE.md, `docs/spec.md` and a
milestone plan, plus plugin recommendations. Write no feature code here; implementation starts in a
fresh session with a clean context.

## 0. Ask first

One AskUserQuestion round: what it is (one sentence), the stack, the folder path, whether it sits
under a workspace root next to related projects, and whether Codex will also work in it. Confirm
the exact path before creating anything. If the folder already exists and isn't empty, stop and ask.

## 1. Scaffold with the official generator

Never hand-write boilerplate a generator produces. Check the toolchain first (`node --version`,
`dotnet --version`) and if something is missing, tell the user what to install instead of
installing it. Run `--help` on the generator before using it, because flags change between
versions, and run it non-interactively (flags or `--yes`).

| Stack | Generator |
|---|---|
| Next.js | `npx create-next-app@latest <name>` with TypeScript, ESLint, App Router flags |
| .NET API | `dotnet new sln`, `dotnet new webapi`, `dotnet new xunit` for tests, `dotnet sln add` both |
| Unity | ask the user to create it in Unity Hub (editor version and template), then continue at step 2 |
| Other | the ecosystem's standard init (`npm init`, `cargo new`, `uv init`, ...) |

Then `git init` if the generator didn't, and commit: `Scaffold <name> with <generator>`.

## 2. Set up lean-kit

Read `${CLAUDE_SKILL_DIR}/../kit-init/SKILL.md` and follow its steps 1 to 4 in the new folder (in
that file, `${CLAUDE_SKILL_DIR}` means the kit-init folder). Its plugin step waits until after the
spec (step 4 below). The approval from step 0 covers it: list what you write instead of asking
again. The build and test commands now exist, so run each one before putting it in CLAUDE.md.

## 3. Spec by interview

Interview with AskUserQuestion, at most three rounds, asking only what changes the design: core
users and flows, data and persistence, auth and integrations, platforms and performance limits,
what is out of scope for v1, and how to tell v1 works. Skip anything obvious or already answered.

Then write `docs/spec.md`, aiming for under 150 lines:

```markdown
# <Name>: spec
## Goal            one paragraph
## Core flows      numbered, one line each
## Scope (v1)
## Out of scope
## Interfaces      endpoints, data model sketch, external services
## Constraints     platforms, performance, security
## Acceptance      one end-to-end check that proves v1 works
## Open questions
```

Show it to the user and apply their corrections before planning.

## 4. Recommend plugins

Run `node "${CLAUDE_SKILL_DIR}/../kit-init/scripts/suggest-plugins.mjs" --dir <project> --terms "<terms>"`,
where the terms are the services, frameworks and hosting the spec names (for example
`stripe,postgres,sentry,vercel`). It checks the marketplaces registered on this machine and skips
installed plugins. Present at most five picks, best first: the language server for the main
language, then vendor plugins for services the spec relies on. For each, give the reason, what it
adds to every session and the `/plugin install` id, and flag a missing language server binary with
its install command. Install nothing; the user picks.

## 5. Milestone plan

Split the spec into milestones sized for one session each. Every milestone ends with a check
Claude can run: a test, a build, a script or a screenshot. Milestone 1 is a walking skeleton: the
thinnest end-to-end path that builds, runs and has one passing test.

- Up to about 8 milestones: `docs/plan.md` as a checklist, one milestone per heading with its goal,
  files touched and check, under 100 lines.
- Bigger multi-day builds: `docs/features.json`, a list of
  `{"id", "description", "check", "passes": false}` entries. Only flip `passes` after its check
  passes, and never delete entries. JSON is less likely than markdown to be rewritten carelessly
  across sessions (Anthropic's long-running agent harness).

## 6. Finish

1. Commit: `Add spec and milestone plan`.
2. If the project sits under a workspace root with its own CLAUDE.md or AGENTS.md map, add one
   line for it there.
3. Tell the user the next step: a new session opened in the project folder, so its CLAUDE.md and
   settings load, then "implement milestone 1 from docs/plan.md". Suggest pushing to a private
   GitHub repository so other machines can resume.
