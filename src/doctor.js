import fs from 'node:fs';
import {
  ADAPTER_CONFIG,
  CLAUDE_3P_CONFIG_LIBRARY,
  CLAUDE_SETTINGS,
  LAUNCH_AGENT,
  LOG_FILE,
} from './paths.js';
import { DEFAULT_PORT, loadState, readJson } from './config.js';
import { resolveAdapterRoot } from './patch.js';

export async function printDoctor() {
  const port = loadState()?.port || DEFAULT_PORT;
  console.log('claude-gpt/codex-bridge doctor\n');

  const checks = [];

  checks.push(['adapter config', fs.existsSync(ADAPTER_CONFIG)]);
  checks.push(['claude settings', fs.existsSync(CLAUDE_SETTINGS)]);
  checks.push(['launch agent', process.platform !== 'darwin' || fs.existsSync(LAUNCH_AGENT)]);

  let adapterOk = false;
  try {
    const root = resolveAdapterRoot();
    adapterOk = true;
    checks.push([`claude-adapter @ ${root}`, true]);
    checks.push([
      'responsesBridge present',
      fs.existsSync(`${root}/dist/converters/responsesBridge.js`),
    ]);
  } catch (e) {
    checks.push([`claude-adapter (${e.message})`, false]);
  }

  const adapter = readJson(ADAPTER_CONFIG, null);
  if (adapter) {
    checks.push(['api key set', Boolean(adapter.apiKey)]);
    checks.push(['proxy token set', Boolean(adapter.proxyAuthToken)]);
    checks.push(['gpt-6.2 mapped', adapter.models?.sonnet === 'gpt-6.2-sol']);
    checks.push(['gpt-6.1 mapped', Boolean(adapter.models?.sonnet61 || adapter.models?.opus61)]);
  }

  let listening = false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      headers: { Authorization: `Bearer ${adapter?.proxyAuthToken || ''}` },
    });
    listening = res.status === 200 || res.status === 401;
    checks.push([`proxy :${port}`, listening]);
    if (res.status === 200) {
      const body = await res.json();
      checks.push([`models listed (${(body.data || []).length})`, true]);
    }
  } catch {
    checks.push([`proxy :${port}`, false]);
  }

  if (process.platform === 'darwin') {
    const meta = readJson(`${CLAUDE_3P_CONFIG_LIBRARY}/_meta.json`, null);
    checks.push(['Claude-3p configLibrary', Boolean(meta?.appliedId)]);
  }

  for (const [name, ok] of checks) {
    console.log(`${ok ? '✔' : '✖'} ${name}`);
  }

  if (fs.existsSync(LOG_FILE)) {
    console.log(`\nlog: ${LOG_FILE}`);
  }

  if (!adapterOk || !listening) {
    console.log('\nTry: npx codex-bridge setup --api-key "$OPENAI_API_KEY"');
  }
}
