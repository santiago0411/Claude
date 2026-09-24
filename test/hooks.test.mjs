// Run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin', 'scripts');
const lines = (n, word = 'rule') => Array.from({ length: n }, (_, i) => `- ${word} ${i}`).join('\n') + '\n';

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-kit-test-'));
  const project = path.join(root, 'project');
  const home = path.join(root, 'home');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const run = (script, args, payload) => spawnSync('node', [path.join(SCRIPTS, script), ...args], {
    input: JSON.stringify({ cwd: project, session_id: `t-${path.basename(root)}`, ...payload }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
  const write = (rel, text) => {
    const p = path.join(project, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
    return p;
  };
  return { project, home, run, write };
}

const pre = (s, tool, input) => s.run('budget-guard.mjs', ['pre'], { tool_name: tool, tool_input: input });

test('new handoff under the cap is allowed', () => {
  const s = sandbox();
  const r = pre(s, 'Write', { file_path: path.join(s.project, 'HANDOFF.md'), content: lines(30) });
  assert.equal(r.status, 0);
});

test('new handoff over the cap is blocked with a reason for Claude', () => {
  const s = sandbox();
  const r = pre(s, 'Write', { file_path: path.join(s.project, 'HANDOFF.md'), content: lines(70) });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /HANDOFF\.md would be 70 lines/);
  assert.match(r.stderr, /Fix: Overwrite it as a snapshot/);
});

test('over-budget file: shrinking edit allowed, growing edit blocked', () => {
  const s = sandbox();
  const file = s.write('CLAUDE.md', lines(210));
  assert.equal(pre(s, 'Edit', { file_path: file, old_string: '- rule 5\n', new_string: '' }).status, 0);
  const grow = pre(s, 'Edit', { file_path: file, old_string: '- rule 5\n', new_string: '- rule 5\n- one more\n' });
  assert.equal(grow.status, 2);
  assert.match(grow.stderr, /it is 210 lines/);
});

test('replace_all is simulated before measuring', () => {
  const s = sandbox();
  const file = s.write('HANDOFF.md', lines(50, 'x'));
  const r = pre(s, 'Edit', { file_path: file, old_string: 'x', new_string: 'x\n- y', replace_all: true });
  assert.equal(r.status, 2);
});

test('files without a budget are ignored', () => {
  const s = sandbox();
  const r = pre(s, 'Write', { file_path: path.join(s.project, 'src', 'app.ts'), content: lines(5000) });
  assert.equal(r.status, 0);
});

test('a project override can switch a rule off', () => {
  const s = sandbox();
  s.write('.claude/budgets.json', JSON.stringify({ rules: [{ glob: '**/docs/**/*.md', off: true }] }));
  const r = pre(s, 'Write', { file_path: path.join(s.project, 'docs', 'api.md'), content: lines(900) });
  assert.equal(r.status, 0);
});

test('global CLAUDE.md has the tighter cap', () => {
  const s = sandbox();
  const r = pre(s, 'Write', { file_path: path.join(s.home, '.claude', 'CLAUDE.md'), content: lines(70) });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cap is 60 lines/);
});

test('stop backstop reports growth past the cap once, and never loops', () => {
  const s = sandbox();
  const git = (...a) => execFileSync('git', a, { cwd: s.project, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  s.write('CLAUDE.md', lines(100));
  git('add', '.');
  git('commit', '-qm', 'init');
  s.write('CLAUDE.md', lines(230));

  const first = s.run('budget-guard.mjs', ['stop'], { stop_hook_active: false });
  assert.equal(first.status, 0);
  assert.equal(JSON.parse(first.stdout).decision, 'block');
  assert.match(JSON.parse(first.stdout).reason, /CLAUDE\.md: 230 lines/);

  assert.equal(s.run('budget-guard.mjs', ['stop'], { stop_hook_active: false }).stdout, '');
  assert.equal(s.run('budget-guard.mjs', ['stop'], { stop_hook_active: true }).stdout, '');
});

test('stop backstop ignores an over-budget file that did not grow', () => {
  const s = sandbox();
  const git = (...a) => execFileSync('git', a, { cwd: s.project, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  s.write('CLAUDE.md', lines(230));
  git('add', '.');
  git('commit', '-qm', 'init');
  assert.equal(s.run('budget-guard.mjs', ['stop'], {}).stdout, '');
});

test('session start: notice on startup, full handoff after compaction, warning on big resume', () => {
  const s = sandbox();
  s.write('HANDOFF.md', '# Handoff: login flow\n\n## Next\n1. wire callback\n');

  const startup = JSON.parse(s.run('session-start.mjs', [], { source: 'startup' }).stdout);
  assert.match(startup.hookSpecificOutput.additionalContext, /"Handoff: login flow", updated today/);

  const compact = JSON.parse(s.run('session-start.mjs', [], { source: 'compact' }).stdout);
  assert.match(compact.hookSpecificOutput.additionalContext, /1\. wire callback/);

  const resume = JSON.parse(s.run('session-start.mjs', [], {
    source: 'resume', context_tokens: 250000, prompt_cache_likely_expired: true,
  }).stdout);
  assert.match(resume.systemMessage, /about 250K tokens/);
});

test('session start flags an over-budget CLAUDE.md to the user only', () => {
  const s = sandbox();
  s.write('CLAUDE.md', lines(250));
  const out = JSON.parse(s.run('session-start.mjs', [], { source: 'startup' }).stdout);
  assert.match(out.systemMessage, /CLAUDE\.md is over budget \(250 lines/);
  assert.equal(out.hookSpecificOutput, undefined);
});
