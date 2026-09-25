#!/usr/bin/env node
// Suggest Claude Code plugins for a project from the marketplaces already registered on this machine.
//
//   node suggest-plugins.mjs [--dir <project>] [--terms "stripe,postgres,sentry"]
//
// Signals: file extensions (matched to plugins' LSP servers), dependencies in package.json and
// *.csproj, marker files (vercel.json, prisma/schema.prisma, a Unity project...), and --terms taken
// from the spec. Installed plugins are skipped. Prints a short list; installs nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const DIR = path.resolve(arg('--dir') || '.');
const TERMS = (arg('--terms') || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
const PLUGINS_DIR = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'plugins');
// Generated, vendored and build-output folders don't say what the project is written in
// (Unity IL2CPP builds, for example, dump hundreds of .cpp files).
const SKIP_DIR = /^(node_modules|\.git|Library|Temp|Logs|obj|bin|\.next|dist|coverage|vendor|third_?party|external)$|build(s)?$|_BackUpThisFolder_ButDontShipItWithYourGame$/i;
const STOP = new Set([
  'js', 'ts', 'node', 'types', 'type', 'core', 'client', 'server', 'sdk', 'api', 'test', 'tests', 'testing', 'react',
  'next', 'dom', 'app', 'cli', 'config', 'eslint', 'plugin', 'utils', 'util', 'tools', 'tool', 'microsoft', 'system',
  'extensions', 'extension', 'aspnetcore', 'net', 'dotnet', 'runner', 'visualstudio', 'coverlet', 'collector',
  'design', 'abstractions', 'http', 'json', 'web', 'ui', 'kit', 'lib', 'dev', 'build', 'framework', 'logging',
  'hosting', 'options', 'configuration', 'identity', 'tokens', 'jwt', 'bearer', 'authentication', 'authorization',
  'entityframeworkcore', 'sqlserver', 'sqlite', 'postcss', 'autoprefixer', 'prettier', 'vite', 'vitest', 'jest',
  'babel', 'webpack', 'typescript', 'com', 'modules', 'module', 'native',
]);
// Marker files and folders that name a service or framework.
const MARKERS = {
  'vercel.json': 'vercel', 'netlify.toml': 'netlify', 'wrangler.toml': 'cloudflare', 'wrangler.json': 'cloudflare',
  'firebase.json': 'firebase', 'supabase/config.toml': 'supabase', 'prisma/schema.prisma': 'prisma',
  'playwright.config.ts': 'playwright', 'playwright.config.js': 'playwright', 'convex': 'convex',
  'ProjectSettings/ProjectVersion.txt': 'unity',
};
// Stack-level suggestions that dependency names alone don't reveal.
const DERIVED = { next: ['frontend-design'], react: ['frontend-design'], vue: ['frontend-design'], svelte: ['frontend-design'] };
const LSP_INSTALL = {
  'csharp-ls': 'dotnet tool install --global csharp-ls',
  'typescript-language-server': 'npm install -g typescript-language-server typescript',
  'pyright-langserver': 'npm install -g pyright',
  gopls: 'go install golang.org/x/tools/gopls@latest',
  'rust-analyzer': 'rustup component add rust-analyzer',
};

const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};

// 1. Catalogs from registered marketplaces; fall back to fetching the official one.
const catalogs = [];
for (const [name, info] of Object.entries(readJson(path.join(PLUGINS_DIR, 'known_marketplaces.json')) ?? {})) {
  const m = info.installLocation && readJson(path.join(info.installLocation, '.claude-plugin', 'marketplace.json'));
  if (m?.plugins) catalogs.push({ name, root: info.installLocation, plugins: m.plugins });
}
if (!process.env.LEAN_KIT_OFFLINE && !catalogs.some((c) => c.name === 'claude-plugins-official')) {
  try {
    const url = 'https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json';
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) catalogs.push({ name: 'claude-plugins-official', root: null, plugins: (await res.json()).plugins });
  } catch {
    // Offline: suggest from whatever is registered locally.
  }
}

const installed = new Set(Object.keys(readJson(path.join(PLUGINS_DIR, 'installed_plugins.json'))?.plugins ?? {}));
const settings = readJson(path.join(path.dirname(PLUGINS_DIR), 'settings.json')) ?? {};
for (const [id, on] of Object.entries(settings.enabledPlugins ?? {})) if (on) installed.add(id);

// 2. Project signals.
const files = listFiles(DIR);
const extCount = {};
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
}
const reasons = new Map(); // term -> why
const addTerm = (term, why) => {
  if (!reasons.has(term)) reasons.set(term, why);
};
for (const f of files.filter((f) => /(^|\/)package\.json$/.test(f) && f.split('/').length <= 2)) {
  const pkg = readJson(path.join(DIR, f)) ?? {};
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    for (const t of tokens(dep)) addTerm(t, `dependency ${dep}`);
    for (const t of DERIVED[dep] ?? []) addTerm(t, `uses ${dep}`);
  }
}
for (const f of files.filter((f) => f.endsWith('.csproj') && f.split('/').length <= 3)) {
  const xml = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const [, dep] of xml.matchAll(/<PackageReference\s+Include="([^"]+)"/g)) {
    for (const t of tokens(dep)) addTerm(t, `package ${dep}`);
  }
  addTerm('microsoft-docs', '.NET project');
}
for (const [marker, term] of Object.entries(MARKERS)) {
  const hit = files.some((f) => f === marker || f.endsWith(`/${marker}`) || f.startsWith(`${marker}/`));
  if (hit) addTerm(term, `found ${marker}`);
}
for (const t of TERMS) addTerm(t, 'from the spec');

// 3. Match.
let lsp = [], related = [];
const stack = [];
const perTerm = {}; // keep one broad term (say, aws) from flooding the list
for (const c of catalogs) {
  for (const p of c.plugins) {
    const id = `${p.name}@${c.name}`;
    if (installed.has(id)) continue;
    const exts = Object.values(p.lspServers ?? {}).flatMap((s) => Object.keys(s.extensionToLanguage ?? {}));
    const nFiles = exts.reduce((n, e) => n + (extCount[e.toLowerCase()] || 0), 0);
    if (nFiles > 0) {
      const cmd = Object.values(p.lspServers)[0]?.command;
      lsp.push({ id, p, c, files: nFiles, why: `${nFiles} ${exts.filter((e) => extCount[e.toLowerCase()]).join('/')} files`, cmd });
      continue;
    }
    const name = p.name.toLowerCase();
    const byName = [...reasons.keys()].find((t) => name === t || name.startsWith(`${t}-`));
    if (byName) {
      perTerm[byName] = (perTerm[byName] || 0) + 1;
      if (perTerm[byName] <= 3) stack.push({ id, p, c, why: reasons.get(byName) });
      continue;
    }
    const byText = TERMS.find((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(p.description ?? ''));
    if (byText) related.push({ id, p, c, term: byText, why: `description mentions "${byText}"` });
  }
}
// A language counts when it has at least 5 files and 10% of the main language's count.
const topLsp = Math.max(0, ...lsp.map((s) => s.files));
lsp = lsp.filter((s) => s.files >= 5 && s.files >= topLsp * 0.1);
// Description matches only for spec terms that no plugin name matched ("postgres", not "stripe").
related = related.filter((s) => !perTerm[s.term]);

// 4. Report.
const out = [`Plugin suggestions for ${DIR}`, `(${catalogs.length} marketplaces, ${catalogs.reduce((n, c) => n + c.plugins.length, 0)} plugins checked)`];
const line = (s) => {
  const author = s.p.author?.name ? ` (${s.p.author.name})` : '';
  const cost = footprint(s.p, s.c);
  return `- ${s.id}${author}: ${oneLine(s.p.description)} Why: ${s.why}.${cost ? ` Adds: ${cost}.` : ''}`;
};
if (lsp.length) {
  out.push('', 'Code intelligence (go-to-definition and type errors instead of grep-and-read):');
  for (const s of lsp.sort((a, b) => b.files - a.files)) {
    const found = onPath(s.cmd);
    out.push(`${line(s)} Needs \`${s.cmd}\` on PATH: ${found ? 'found' : `missing${LSP_INSTALL[s.cmd] ? `, install with \`${LSP_INSTALL[s.cmd]}\`` : ''}`}.`);
  }
}
if (stack.length) {
  out.push('', 'Matches what the project uses:');
  for (const s of stack.slice(0, 8)) out.push(line(s));
}
if (related.length) {
  out.push('', 'Possibly related to the spec (check before installing):');
  for (const s of related.slice(0, 5)) out.push(line(s));
}
if (!lsp.length && !stack.length && !related.length) out.push('', 'No matching plugins found.');
if (installed.size) out.push('', `Already installed: ${[...installed].join(', ')}`);
out.push('', 'Install with /plugin install <id>, then /reload-plugins. Each plugin adds skill descriptions, hooks or MCP servers to every session: check /context after installing.');
console.log(out.join('\n'));

function tokens(dep) {
  return dep.toLowerCase().replace(/^@/, '').split(/[/.\-_]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}

function listFiles(dir) {
  try {
    const out = execFileSync('git', ['ls-files'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20, timeout: 10000 })
      .toString().split('\n').filter((f) => f && !f.split('/').slice(0, -1).some((d) => SKIP_DIR.test(d)));
    if (out.length) return out;
  } catch {
    // Not a git repository yet (or git refuses it): walk the tree instead.
  }
  const found = [];
  const walk = (d, rel, depth) => {
    if (depth > 5 || found.length > 20000) return;
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIR.test(e.name)) walk(path.join(d, e.name), r, depth + 1);
      } else {
        found.push(r);
      }
    }
  };
  walk(dir, '', 0);
  return found;
}

function onPath(cmd) {
  if (!cmd) return false;
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  return (process.env.PATH || '').split(path.delimiter).some((d) => exts.some((x) => fs.existsSync(path.join(d, cmd + x.toLowerCase())) || fs.existsSync(path.join(d, cmd + x))));
}

// What a plugin bundled in the marketplace repository adds; external plugins are unknown until installed.
function footprint(p, c) {
  if (typeof p.source !== 'string' || !c.root) return typeof p.source === 'object' ? 'contents unknown until installed (external repository)' : '';
  const root = path.join(c.root, p.source);
  const parts = [];
  const count = (sub) => {
    try {
      return fs.readdirSync(path.join(root, sub)).length;
    } catch {
      return 0;
    }
  };
  const skills = count('skills'), agents = count('agents');
  if (skills) parts.push(`${skills} skill${skills > 1 ? 's' : ''}`);
  if (agents) parts.push(`${agents} agent${agents > 1 ? 's' : ''}`);
  if (fs.existsSync(path.join(root, 'hooks', 'hooks.json'))) parts.push('hooks');
  if (fs.existsSync(path.join(root, '.mcp.json'))) parts.push('an MCP server');
  return parts.join(', ');
}

function oneLine(s) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  const first = t.split(/(?<=\.)\s/)[0];
  return first.length > 140 ? `${first.slice(0, 137)}...` : first.endsWith('.') ? first : `${first}.`;
}
