import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');
export const HOME = os.homedir();

export const ADAPTER_CONFIG = path.join(HOME, '.claude-adapter', 'config.json');
export const CLAUDE_SETTINGS = path.join(HOME, '.claude', 'settings.json');
export const CLAUDE_3P_DIR = path.join(HOME, 'Library', 'Application Support', 'Claude-3p');
export const CLAUDE_3P_CONFIG_LIBRARY = path.join(CLAUDE_3P_DIR, 'configLibrary');
export const LAUNCH_AGENT = path.join(HOME, 'Library', 'LaunchAgents', 'com.jhih.codex-bridge.plist');
export const LOG_FILE = path.join(HOME, 'Library', 'Logs', 'codex-bridge.log');
export const DAEMON_WRAPPER = path.join(HOME, '.local', 'bin', 'codex-bridge-daemon');
export const LOCAL_BIN = path.join(HOME, '.local', 'bin');
export const STATE_FILE = path.join(HOME, '.codex-bridge', 'state.json');

export function templates(...parts) {
  return path.join(ROOT, 'templates', ...parts);
}
