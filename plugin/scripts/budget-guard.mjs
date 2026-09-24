#!/usr/bin/env node
// lean-kit budget guard.
//   pre:  PreToolUse on Write|Edit. Denies a write that leaves a context file over its cap AND bigger
//         than it was. Shrinking an over-budget file is always allowed, so old bloat can only go down.
//   stop: Stop backstop for growth that bypassed Write/Edit (shell redirects, other agents such as Codex).
//         Compares against the committed version and reports each file once per size per session.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  readStdinJson, readText, projectDirOf, loadBudgets, findBudget, measure, isOver, grew, describe, cap, norm,
} from './lib.mjs';

const input = readStdinJson();
const projectDir = projectDirOf(input);
const rules = loadBudgets(projectDir);
const rel = (file) => path.relative(projectDir, file).replace(/\\/g, '/') || file;

if (process.argv[2] === 'pre') pre();
else if (process.argv[2] === 'stop') stop();

function pre() {
  const t = input.tool_input || {};
  if (!t.file_path) return;
  const file = path.resolve(projectDir, t.file_path);
  const budget = findBudget(rules, file);
  if (!budget) return;

  const before = readText(file);
  let after;
  if (input.tool_name === 'Write') {
    after = t.content ?? '';
  } else if (input.tool_name === 'Edit') {
    // Let the Edit tool report a missing file or string itself.
    if (before == null || !t.old_string || !before.includes(t.old_string)) return;
    after = t.replace_all
      ? before.split(t.old_string).join(t.new_string ?? '')
      : before.replace(t.old_string, () => t.new_string ?? '');
  } else {
    return;
  }

  const now = measure(after);
  const was = before == null ? null : measure(before);
  if (!isOver(now, budget)) return;
  if (was && !grew(now, was)) return;

  process.stderr.write([
    `lean-kit budget: ${rel(file)} would be ${describe(now)}; the cap is ${cap(budget)}` +
      (was ? ` (it is ${describe(was)} now).` : '.'),
    `Why: ${budget.why}`,
    `Fix: ${budget.fix}`,
    'Shrinking an over-budget file is always allowed; growing it is not. Do not work around this with shell writes. ' +
      'If the user explicitly wants a bigger cap, they can set one in .claude/budgets.json.',
  ].join('\n'));
  process.exit(2);
}

function stop() {
  if (input.stop_hook_active) return;

  const candidates = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'HANDOFF.md']
    .map((f) => path.join(projectDir, f))
    .concat(listMarkdown(path.join(projectDir, '.claude', 'rules')))
    .concat(path.join(os.homedir(), '.claude', 'CLAUDE.md'));

  const statePath = path.join(os.tmpdir(), 'lean-kit', `${input.session_id || 'no-session'}.json`);
  let reported = {};
  try {
    reported = JSON.parse(readText(statePath) ?? '{}');
  } catch {
    // Corrupt state only means a finding may be repeated once.
  }
  const findings = [];

  for (const file of new Set(candidates)) {
    const budget = findBudget(rules, file);
    const text = budget ? readText(file) : null;
    if (text == null) continue;
    const now = measure(text);
    if (!isOver(now, budget) || !grewThisSession(file, now)) continue;
    const key = norm(file);
    if (reported[key] === describe(now)) continue;
    reported[key] = describe(now);
    findings.push(`- ${rel(file)}: ${describe(now)}, cap ${cap(budget)}. ${budget.fix}`);
  }
  if (!findings.length) return;

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(reported));
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `lean-kit budget: these context files grew past their caps during this session:\n${findings.join('\n')}\n` +
      'Trim them before finishing. If the user made the edit, tell them instead of editing it.',
  }));
}

function listMarkdown(dir) {
  try {
    return fs.readdirSync(dir, { recursive: true })
      .filter((f) => String(f).endsWith('.md'))
      .map((f) => path.join(dir, String(f)));
  } catch {
    return [];
  }
}

// Grew compared with the committed version; for untracked files or files outside a git
// repository, fall back to "modified since this session's transcript was created".
function grewThisSession(file, now) {
  const r = path.relative(projectDir, file).replace(/\\/g, '/');
  if (!r.startsWith('..') && !path.isAbsolute(r)) {
    try {
      const head = execFileSync('git', ['show', `HEAD:${r}`], {
        cwd: projectDir, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
      }).toString();
      return grew(now, measure(head));
    } catch {
      // Untracked, no commits yet, or not a git repository.
    }
  }
  try {
    const since = fs.statSync(input.transcript_path).birthtimeMs;
    return since > 0 && fs.statSync(file).mtimeMs >= since;
  } catch {
    return false;
  }
}
