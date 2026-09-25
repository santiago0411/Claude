#!/usr/bin/env node
// lean-kit installer. Idempotent: run it again after `git pull`.
//
//   node install.mjs [--dry-run] [--codex] [--statusline]
//   node install.mjs --uninstall
//
// Linked (live; `git pull` updates them): the lean-kit plugin and the skills.
// Copied (re-run to update):               global CLAUDE.md, rules, agents, and with --codex AGENTS.md.
// Merged:                                  a few keys in ~/.claude/settings.json.
// Anything replaced is first moved or copied to ~/.claude/backups/lean-kit-<timestamp>/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const CODEX = process.env.CODEX_HOME || path.join(HOME, '.codex');
const AGENT_SKILLS = path.join(HOME, '.agents', 'skills');
const MANIFEST = path.join(CLAUDE, 'lean-kit.json');
const CODEX_SKILLS = ['handoff', 'claude-md-audit']; // Agent Skills standard only; kit-init is Claude-specific
const WIN = process.platform === 'win32';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP = path.join(CLAUDE, 'backups', `lean-kit-${stamp}`);

if (args.has('--help') || args.has('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n'));
  process.exit(0);
}

const log = (verb, what) => console.log(`${DRY ? '[dry-run] ' : ''}${verb.padEnd(9)} ${what}`);
const tilde = (p) => (p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p).replace(/\\/g, '/');
const canon = (p) => {
  const s = path.resolve(p.replace(/^\\\\\?\\/, ''));
  return WIN ? s.toLowerCase() : s;
};
const manifest = readJson(MANIFEST) ?? { links: [], copies: [], settings: {} };

if (args.has('--uninstall')) uninstall();
else install();

function install() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) fail(`Node.js 18 or newer is required (found ${process.versions.node}).`);

  link(path.join(REPO, 'plugin'), path.join(CLAUDE, 'skills', 'lean-kit'));
  for (const name of dirs(path.join(REPO, 'skills'))) {
    link(path.join(REPO, 'skills', name), path.join(CLAUDE, 'skills', name));
  }

  copy(path.join(REPO, 'user', 'CLAUDE.global.md'), path.join(CLAUDE, 'CLAUDE.md'));
  for (const sub of ['rules', 'agents']) {
    for (const f of files(path.join(REPO, 'user', sub))) {
      copy(path.join(REPO, 'user', sub, f), path.join(CLAUDE, sub, f));
    }
  }

  const settings = readJson(path.join(REPO, 'user', 'settings.json'));
  if (args.has('--statusline')) {
    const script = path.join(REPO, 'plugin', 'scripts', 'statusline.mjs').replace(/\\/g, '/');
    settings.statusLine = { type: 'command', command: `node "${script}"` };
  }
  mergeSettings(settings);

  if (args.has('--codex')) {
    for (const name of CODEX_SKILLS) link(path.join(REPO, 'skills', name), path.join(AGENT_SKILLS, name));
    copy(path.join(REPO, 'user', 'codex', 'AGENTS.global.md'), path.join(CODEX, 'AGENTS.md'));
  }

  manifest.repo = REPO;
  manifest.updated = new Date().toISOString();
  writeJson(MANIFEST, manifest);

  console.log(`
Done${DRY ? ' (dry run: nothing was changed)' : ''}. Next:
  1. Restart Claude Code, or run /reload-plugins, so the lean-kit hooks load.
  2. New project: /new-project. Existing project: /kit-init once, or /claude-md-audit where a CLAUDE.md exists.
  3. Edit the files in this repository, not the copies in ~/.claude; then run this installer again.${
  args.has('--codex') ? `
  4. Codex: npm install -g @openai/codex, then codex login. In Claude Code:
     /plugin marketplace add openai/codex-plugin-cc, /plugin install codex@openai-codex, /codex:setup` : ''}`);
}

function uninstall() {
  for (const l of [...manifest.links].reverse()) {
    if (isLinkTo(l.path, l.target)) {
      removeLink(l.path);
      log('unlink', tilde(l.path));
    }
    if (l.previous && !DRY && !fs.existsSync(l.path)) {
      fs.renameSync(l.previous, l.path);
      log('restore', tilde(l.path));
    }
  }
  for (const c of [...manifest.copies].reverse()) {
    if (c.previous && fs.existsSync(c.previous)) {
      if (!DRY) fs.copyFileSync(c.previous, c.path);
      log('restore', tilde(c.path));
    } else if (!c.previous && fs.existsSync(c.path)) {
      if (!DRY) fs.rmSync(c.path);
      log('remove', tilde(c.path));
    }
  }
  const file = path.join(CLAUDE, 'settings.json');
  const current = readJson(file) ?? {};
  for (const [key, { previous, value }] of Object.entries(manifest.settings)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) continue; // changed since; leave it
    if (previous === undefined) delete current[key];
    else current[key] = previous;
    log('setting', `${key} restored`);
  }
  if (!DRY) {
    writeJson(file, current);
    fs.rmSync(MANIFEST, { force: true });
  }
  console.log(`\nUninstalled${DRY ? ' (dry run)' : ''}. Backups stay in ${tilde(path.join(CLAUDE, 'backups'))}.`);
}

// Directory link: a junction on Windows (no admin rights needed), a symlink elsewhere.
function link(target, linkPath) {
  if (isLinkTo(linkPath, target)) {
    record(manifest.links, { path: linkPath, target, previous: null });
    return log('ok', `${tilde(linkPath)} -> ${tilde(target)}`);
  }
  let previous = null;
  if (isLink(linkPath)) {
    if (!DRY) removeLink(linkPath);
  } else if (fs.existsSync(linkPath)) {
    previous = path.join(BACKUP, path.relative(HOME, linkPath));
    if (!DRY) {
      fs.mkdirSync(path.dirname(previous), { recursive: true });
      fs.renameSync(linkPath, previous);
    }
    log('backup', `${tilde(linkPath)} -> ${tilde(previous)}`);
  }
  if (!DRY) {
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath, WIN ? 'junction' : 'dir');
  }
  log('link', `${tilde(linkPath)} -> ${tilde(target)}`);
  record(manifest.links, { path: linkPath, target, previous });
}

function copy(src, dest) {
  const next = fs.readFileSync(src);
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (existing && existing.equals(next)) {
    record(manifest.copies, { path: dest, previous: null });
    return log('ok', tilde(dest));
  }
  let previous = manifest.copies.find((c) => canon(c.path) === canon(dest))?.previous ?? null;
  if (existing) {
    const backup = path.join(BACKUP, path.relative(HOME, dest));
    if (!DRY) {
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, existing);
    }
    previous ??= backup;
    log('backup', `${tilde(dest)} -> ${tilde(backup)}`);
  }
  if (!DRY) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, next);
  }
  log('copy', `${tilde(src)} -> ${tilde(dest)}`);
  record(manifest.copies, { path: dest, previous });
}

function mergeSettings(wanted) {
  const file = path.join(CLAUDE, 'settings.json');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}';
  let current;
  try {
    current = JSON.parse(raw.replace(/^﻿/, ''));
  } catch {
    fail(`${tilde(file)} is not valid JSON; fix it and run the installer again.`);
  }
  let changed = false;
  for (const [key, value] of Object.entries(wanted)) {
    if (JSON.stringify(current[key]) === JSON.stringify(value)) {
      log('ok', `settings.${key}`);
      continue;
    }
    if (!(key in manifest.settings)) manifest.settings[key] = { previous: current[key] };
    manifest.settings[key].value = value;
    current[key] = value;
    changed = true;
    log('setting', `${key} = ${JSON.stringify(value)}`);
  }
  if (!changed) return;
  if (fs.existsSync(file) && !DRY) {
    fs.mkdirSync(BACKUP, { recursive: true });
    fs.copyFileSync(file, path.join(BACKUP, 'settings.json'));
  }
  if (!DRY) writeJson(file, current);
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function isLinkTo(p, target) {
  try {
    return isLink(p) && canon(fs.readlinkSync(p)) === canon(target);
  } catch {
    return false;
  }
}

// Never delete through a link: unlink removes the link itself, rmdir handles Windows junctions.
function removeLink(p) {
  try {
    fs.unlinkSync(p);
  } catch {
    fs.rmdirSync(p);
  }
}

function record(list, entry) {
  const i = list.findIndex((e) => canon(e.path) === canon(entry.path));
  if (i === -1) list.push(entry);
  else list[i] = { ...entry, previous: list[i].previous ?? entry.previous };
}

function dirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

function files(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()) : [];
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function fail(message) {
  console.error(`lean-kit: ${message}`);
  process.exit(1);
}
