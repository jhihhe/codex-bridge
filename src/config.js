import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ADAPTER_CONFIG,
  CLAUDE_3P_CONFIG_LIBRARY,
  CLAUDE_SETTINGS,
  STATE_FILE,
} from './paths.js';

export const DEFAULT_PORT = 3080;

/** Anthropic-looking route IDs Claude Desktop accepts in the model picker. */
export const MODEL_ROUTES = [
  { id: 'claude-opus-4-5', label: 'GPT 6.2 Astra', upstreamKey: 'opus' },
  { id: 'claude-sonnet-4-5', label: 'GPT 6.2 Sol', upstreamKey: 'sonnet' },
  { id: 'claude-haiku-4-5', label: 'GPT 6.2 Sol Fast', upstreamKey: 'haiku' },
  { id: 'claude-opus-4-1', label: 'GPT 6.1 Terra', upstreamKey: 'opus61' },
  { id: 'claude-sonnet-4-1', label: 'GPT 6.1 Sol', upstreamKey: 'sonnet61' },
  { id: 'claude-haiku-4-1', label: 'GPT 6.1 Sol Fast', upstreamKey: 'haiku61' },
];

export const DEFAULT_MODELS = {
  opus: 'gpt-6.2-astra',
  sonnet: 'gpt-6.2-sol',
  haiku: 'gpt-6.2-sol',
  opus61: 'gpt-6.1-terra',
  sonnet61: 'gpt-6.1-sol',
  haiku61: 'gpt-6.1-sol',
};

export function ensureDir(fileOrDir, isFile = false) {
  const dir = isFile ? path.dirname(fileOrDir) : fileOrDir;
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  ensureDir(file, true);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function writeAdapterConfig({ apiKey, proxyAuthToken, models = DEFAULT_MODELS, baseUrl = 'https://api.openai.com/v1' }) {
  const next = {
    baseUrl,
    apiKey,
    proxyAuthToken,
    models,
    toolFormat: 'native',
  };
  writeJson(ADAPTER_CONFIG, next);
  return next;
}

export function writeClaudeCodeSettings({ proxyAuthToken, port = DEFAULT_PORT }) {
  const settings = readJson(CLAUDE_SETTINGS, {}) || {};
  const env = settings.env || {};
  env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  env.ANTHROPIC_AUTH_TOKEN = proxyAuthToken;
  env.ANTHROPIC_DEFAULT_OPUS_MODEL = 'claude-opus-4-5';
  env.ANTHROPIC_DEFAULT_SONNET_MODEL = 'claude-sonnet-4-5';
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL = 'claude-haiku-4-5';
  settings.env = env;
  if (!settings.permissions) {
    settings.permissions = { defaultMode: 'bypassPermissions' };
  }
  writeJson(CLAUDE_SETTINGS, settings);
  return settings;
}

export function writeClaudeDesktopGateway({ proxyAuthToken, port = DEFAULT_PORT }) {
  if (process.platform !== 'darwin') {
    return { skipped: true, reason: 'Claude Desktop gateway auto-config is macOS-only' };
  }

  ensureDir(CLAUDE_3P_CONFIG_LIBRARY);
  const metaPath = path.join(CLAUDE_3P_CONFIG_LIBRARY, '_meta.json');
  let meta = readJson(metaPath, null);
  let cfgId = meta?.appliedId;
  let cfgPath;

  if (cfgId && fs.existsSync(path.join(CLAUDE_3P_CONFIG_LIBRARY, `${cfgId}.json`))) {
    cfgPath = path.join(CLAUDE_3P_CONFIG_LIBRARY, `${cfgId}.json`);
  } else {
    cfgId = crypto.randomUUID();
    cfgPath = path.join(CLAUDE_3P_CONFIG_LIBRARY, `${cfgId}.json`);
    meta = { appliedId: cfgId, updatedAt: Date.now() };
    writeJson(metaPath, meta);
  }

  const existing = readJson(cfgPath, {}) || {};
  const next = {
    ...existing,
    inferenceProvider: 'gateway',
    inferenceCredentialKind: 'static',
    inferenceGatewayAuthScheme: existing.inferenceGatewayAuthScheme || 'bearer',
    inferenceGatewayBaseUrl: `http://127.0.0.1:${port}`,
    inferenceGatewayApiKey: proxyAuthToken,
    modelDiscoveryEnabled: true,
    alwaysStartWithDefaultModel: false,
    inferenceModels: MODEL_ROUTES.map((r) => ({
      name: r.id,
      labelOverride: r.label,
    })),
  };
  writeJson(cfgPath, next);
  return { cfgPath, cfgId, config: next };
}

export function saveState(state) {
  writeJson(STATE_FILE, { ...state, updatedAt: new Date().toISOString() });
}

export function loadState() {
  return readJson(STATE_FILE, null);
}
