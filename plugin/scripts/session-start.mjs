#!/usr/bin/env node
// lean-kit SessionStart: point new sessions at HANDOFF.md, re-inject it after compaction,
// warn before an expensive resume, and flag over-budget context files to the user.
// Notes for the user go in systemMessage, which costs no context tokens.
import fs from 'node:fs';
import path from 'node:path';
import { readStdinJson, readText, projectDirOf, loadBudgets, findBudget, measure, isOver, describe, cap } from './lib.mjs';

const input = readStdinJson();
const projectDir = projectDirOf(input);
const source = input.source;
const notes = [];
let context = '';

const handoffPath = path.join(projectDir, 'HANDOFF.md');
const handoff = readText(handoffPath);
if (handoff != null) {
  if (source === 'compact') {
    context = `HANDOFF.md, re-injected after compaction (the current plan):\n\n${handoff}`;
  } else {
    const title = (handoff.match(/^#\s+(.+)$/m) || [])[1] || 'untitled';
    const days = Math.floor((Date.now() - fs.statSync(handoffPath).mtimeMs) / 864e5);
    context = `HANDOFF.md exists ("${title}", updated ${days === 0 ? 'today' : `${days}d ago`}). ` +
      'If the user is continuing that work, read it first; otherwise ignore it.';
  }
}

if (source === 'resume' && input.context_tokens > 150000) {
  notes.push(`Resuming re-sends about ${Math.round(input.context_tokens / 1000)}K tokens with every request` +
    `${input.prompt_cache_likely_expired ? ', and the cache has expired, so the first request rewrites all of it' : ''}. ` +
    'Cheaper: ask for /handoff, then /clear.');
}

if (source === 'startup') {
  const rules = loadBudgets(projectDir);
  for (const f of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'HANDOFF.md']) {
    const file = path.join(projectDir, f);
    const budget = findBudget(rules, file);
    const text = budget && readText(file);
    if (!text) continue;
    const m = measure(text);
    if (isOver(m, budget)) notes.push(`${f} is over budget (${describe(m)}, cap ${cap(budget)}); run /claude-md-audit.`);
  }
}

const out = {};
if (context) out.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: context };
if (notes.length) out.systemMessage = `lean-kit: ${notes.join(' ')}`;
if (Object.keys(out).length) process.stdout.write(JSON.stringify(out));
