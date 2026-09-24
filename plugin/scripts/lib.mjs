// Shared helpers for lean-kit hooks: hook input, budgets, glob matching, size measurement.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIN = process.platform === 'win32';

export function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function projectDirOf(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

// Absolute, forward slashes, lower case on Windows (its file system ignores case).
export function norm(p) {
  const s = path.resolve(p).replace(/\\/g, '/');
  return WIN ? s.toLowerCase() : s;
}

// Supports **, *, ? and a leading ~/. Patterns without a drive or leading slash match at any depth.
function globToRegex(glob) {
  let g = glob.replace(/\\/g, '/');
  if (g.startsWith('~/')) g = os.homedir().replace(/\\/g, '/') + g.slice(1);
  const absolute = /^([a-zA-Z]:)?\//.test(g);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp((absolute ? '^' : '(?:^|/)') + re + '$', WIN ? 'i' : '');
}

// Project rules from .claude/budgets.json come first, so they override the kit defaults.
export function loadBudgets(projectDir) {
  const kit = JSON.parse(readText(path.join(HERE, '..', 'budgets.json'))).rules;
  let local = [];
  try {
    local = JSON.parse(readText(path.join(projectDir, '.claude', 'budgets.json')) ?? '{}').rules ?? [];
  } catch {
    // A malformed project file must not break every write; fall back to the kit defaults.
  }
  return [...local, ...kit].map((r) => ({ ...r, re: globToRegex(r.glob) }));
}

export function findBudget(rules, file) {
  const p = norm(file);
  const rule = rules.find((r) => r.re.test(p));
  return rule && !rule.off ? rule : null;
}

export function measure(text) {
  if (!text) return { lines: 0, words: 0 };
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return { lines: lines.length, words: (text.match(/\S+/g) || []).length };
}

export const isOver = (m, b) => m.lines > b.maxLines || m.words > b.maxWords;

export const grew = (now, before) => now.lines > before.lines || now.words > before.words;

export const describe = (m) => `${m.lines} lines / ${m.words} words`;

export const cap = (b) => `${b.maxLines} lines / ${b.maxWords} words`;
