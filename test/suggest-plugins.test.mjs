// Run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'kit-init', 'scripts', 'suggest-plugins.mjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-kit-suggest-'));
  const put = (rel, data) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data));
  };
  const market = path.join(root, 'market');
  put('home/.claude/plugins/known_marketplaces.json', { 'test-market': { installLocation: market } });
  put('home/.claude/plugins/installed_plugins.json', { version: 2, plugins: { 'caveman@test-market': [] } });
  put('market/.claude-plugin/marketplace.json', {
    plugins: [
      { name: 'csharp-lsp', description: 'C# language server.', source: './plugins/csharp-lsp',
        lspServers: { cs: { command: 'fake-csharp-ls', extensionToLanguage: { '.cs': 'csharp' } } } },
      { name: 'typescript-lsp', description: 'TypeScript language server.', source: './plugins/typescript-lsp',
        lspServers: { ts: { command: 'fake-tsls', extensionToLanguage: { '.ts': 'typescript' } } } },
      { name: 'stripe', description: 'Stripe development plugin.', source: './plugins/stripe', author: { name: 'Stripe' } },
      { name: 'frontend-design', description: 'Frontend interfaces.', source: './plugins/frontend-design' },
      { name: 'neon', description: 'Manage Neon postgres databases.', source: { source: 'url', url: 'https://example.invalid' } },
      { name: 'windsor-ai', description: 'Connect data sources such as Stripe.', source: { source: 'url', url: 'https://example.invalid' } },
      { name: 'caveman', description: 'Terse replies.', source: './plugins/caveman' },
    ],
  });
  put('market/plugins/stripe/skills/payments/SKILL.md', '---\nname: payments\n---\n');
  put('market/plugins/stripe/.mcp.json', '{}');
  put('project/package.json', { dependencies: { next: '15.0.0', stripe: '18.0.0' } });
  for (let i = 0; i < 10; i++) put(`project/src/file${i}.ts`, 'export {};\n');
  for (let i = 0; i < 50; i++) put(`project/LinuxBuild/gen${i}.cs`, '// generated\n');
  const run = (...extra) => spawnSync('node', [SCRIPT, '--dir', path.join(root, 'project'), ...extra], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(root, 'home', '.claude'), LEAN_KIT_OFFLINE: '1' },
    encoding: 'utf8',
  });
  return { run };
}

test('suggests the language server, stack matches and their footprint', () => {
  const r = fixture().run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /typescript-lsp@test-market.*10 \.ts files.*Needs `fake-tsls` on PATH: missing/);
  assert.match(r.stdout, /stripe@test-market \(Stripe\).*Why: dependency stripe\. Adds: 1 skill, an MCP server\./);
  assert.match(r.stdout, /frontend-design@test-market.*Why: uses next\./);
});

test('ignores build output when counting languages', () => {
  const r = fixture().run();
  assert.doesNotMatch(r.stdout, /csharp-lsp/);
});

test('skips installed plugins and lists them separately', () => {
  const r = fixture().run();
  assert.doesNotMatch(r.stdout, /^- caveman/m);
  assert.match(r.stdout, /Already installed: caveman@test-market/);
});

test('spec terms: description matches only for terms no plugin name covers', () => {
  const r = fixture().run('--terms', 'postgres,stripe');
  assert.match(r.stdout, /Possibly related[\s\S]*neon@test-market.*mentions "postgres"/);
  assert.doesNotMatch(r.stdout, /windsor-ai/);
});
