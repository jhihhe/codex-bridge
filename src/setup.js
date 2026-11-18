import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_MODELS,
  DEFAULT_PORT,
  randomToken,
  saveState,
  writeAdapterConfig,
  writeClaudeCodeSettings,
  writeClaudeDesktopGateway,
} from './config.js';
import { applyAdapterPatches, resolveAdapterRoot } from './patch.js';
import { startService, writeLaunchAgent } from './service.js';
import { ROOT } from './paths.js';

function ensureLocalClaudeAdapter() {
  // Prefer dependency inside this package
  try {
    return resolveAdapterRoot();
  } catch {
    // install into package node_modules if missing
    console.log('• Installing claude-adapter@2.2.1 …');
    execFileSync('npm', ['install', 'claude-adapter@2.2.1', '--no-fund', '--no-audit'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    return resolveAdapterRoot();
  }
}

function linkGlobalBin() {
  // Expose `codex-bridge` from this checkout / npx usage is enough;
  // also symlink into ~/.local/bin when possible.
  const destDir = path.join(process.env.HOME || '', '.local', 'bin');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'codex-bridge');
  const src = path.join(ROOT, 'bin', 'codex-bridge.js');
  try {
    if (fs.existsSync(dest) || fs.lstatSync(dest).isSymbolicLink()) {
      fs.unlinkSync(dest);
    }
  } catch {
    try {
      fs.unlinkSync(dest);
    } catch {
      // ignore
    }
  }
  try {
    fs.symlinkSync(src, dest);
    fs.chmodSync(src, 0o755);
  } catch {
    // ignore permission issues
  }
}

export async function setup(args = {}) {
  const port = Number(args.port || process.env.CODEX_BRIDGE_PORT || DEFAULT_PORT);
  let apiKey = args.apiKey || process.env.OPENAI_API_KEY || '';
  let proxyAuthToken = process.env.CODEX_BRIDGE_PROXY_TOKEN || '';

  if (!apiKey) {
    if (args.yes) {
      throw new Error('OPENAI_API_KEY is required. Pass --api-key or set OPENAI_API_KEY.');
    }
    const rl = readline.createInterface({ input, output });
    try {
      console.log('\nclaude-gpt/codex-bridge setup\n');
      apiKey = (await rl.question('OpenAI API Key (sk-…): ')).trim();
    } finally {
      rl.close();
    }
  }

  if (!apiKey.startsWith('sk-')) {
    throw new Error('API key should start with sk-');
  }
  if (!proxyAuthToken) proxyAuthToken = randomToken();

  console.log('\n• Preparing claude-adapter …');
  const adapterRoot = ensureLocalClaudeAdapter();
  console.log(`  adapter: ${adapterRoot}`);

  console.log('• Applying GPT-6.x compatibility patches …');
  const patch = applyAdapterPatches(adapterRoot);
  for (const r of patch.results) {
    console.log(`  - ${r.label}: ${r.status}`);
  }

  console.log('• Writing adapter config ~/.claude-adapter/config.json …');
  writeAdapterConfig({
    apiKey,
    proxyAuthToken,
    models: DEFAULT_MODELS,
  });

  console.log('• Writing Claude Code settings …');
  writeClaudeCodeSettings({ proxyAuthToken, port });

  console.log('• Writing Claude Desktop gateway models …');
  const desktop = writeClaudeDesktopGateway({ proxyAuthToken, port });
  if (desktop.skipped) {
    console.log(`  skipped: ${desktop.reason}`);
  } else {
    console.log(`  config: ${desktop.cfgPath}`);
  }

  if (process.platform === 'darwin') {
    console.log('• Installing LaunchAgent …');
    writeLaunchAgent({ port });
  }

  linkGlobalBin();

  console.log('• Starting local proxy …');
  await startService({ port });

  // Smoke test
  console.log('• Smoke test /v1/models …');
  const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
    headers: { Authorization: `Bearer ${proxyAuthToken}` },
  });
  if (!res.ok) {
    throw new Error(`Proxy /v1/models failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  const names = (body.data || []).map((m) => m.display_name || m.id);
  console.log(`  models: ${names.join(', ')}`);

  saveState({
    configuredAt: new Date().toISOString(),
    port,
    adapterRoot,
    models: DEFAULT_MODELS,
    desktopConfigured: !desktop.skipped,
  });

  console.log(`
✔ Setup complete

Next:
  1. Fully quit & reopen Claude Desktop (or open a new Claude Code session)
  2. Pick a model:
       GPT 6.2 Astra / Sol / Sol Fast
       GPT 6.1 Terra / Sol / Sol Fast
  3. Check status anytime:  npx codex-bridge status

Proxy:  http://127.0.0.1:${port}
`);
}
