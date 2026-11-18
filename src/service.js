import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import {
  DAEMON_WRAPPER,
  LAUNCH_AGENT,
  LOCAL_BIN,
  LOG_FILE,
  templates,
} from './paths.js';
import { DEFAULT_PORT, ensureDir, loadState } from './config.js';
import { resolveAdapterRoot } from './patch.js';

function which(cmd) {
  try {
    return execFileSync('which', [cmd], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function nodeBin() {
  return which('node') || '/usr/local/bin/node';
}

function claudeAdapterBin(adapterRoot) {
  const local = path.join(adapterRoot, 'dist', 'cli.js');
  if (fs.existsSync(local)) return local;
  const bin = which('claude-adapter');
  if (bin) return bin;
  throw new Error('claude-adapter CLI not found');
}

export function writeDaemonWrapper({ port = DEFAULT_PORT } = {}) {
  ensureDir(LOCAL_BIN);
  ensureDir(LOG_FILE, true);
  const adapterRoot = resolveAdapterRoot();
  const adapterCli = claudeAdapterBin(adapterRoot);
  const node = nodeBin();

  const script = `#!/bin/bash
export PATH="${LOCAL_BIN}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if /usr/sbin/lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then
  exit 0
fi
exec "${node}" "${adapterCli}" -p ${port} --no-claude-settings </dev/null
`;
  fs.writeFileSync(DAEMON_WRAPPER, script, { mode: 0o755 });
  return DAEMON_WRAPPER;
}

export function writeLaunchAgent({ port = DEFAULT_PORT } = {}) {
  if (process.platform !== 'darwin') {
    return { skipped: true };
  }
  writeDaemonWrapper({ port });
  ensureDir(LAUNCH_AGENT, true);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.jhih.codex-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>${DAEMON_WRAPPER}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${LOCAL_BIN}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
`;
  fs.writeFileSync(LAUNCH_AGENT, plist, 'utf8');
  try {
    const tmpl = templates('com.jhih.codex-bridge.plist');
    ensureDir(tmpl, true);
    fs.copyFileSync(LAUNCH_AGENT, tmpl);
  } catch {
    // templates copy is optional
  }
  return { plist: LAUNCH_AGENT, wrapper: DAEMON_WRAPPER };
}

function launchctl(...args) {
  execFileSync('/bin/launchctl', args, { stdio: 'inherit' });
}

export async function startService({ port = DEFAULT_PORT } = {}) {
  writeDaemonWrapper({ port });

  if (process.platform === 'darwin') {
    writeLaunchAgent({ port });
    const uid = process.getuid?.() ?? os.userInfo().uid;
    const label = `gui/${uid}/com.jhih.codex-bridge`;
    try {
      launchctl('bootout', label);
    } catch {
      // not loaded
    }
    launchctl('bootstrap', `gui/${uid}`, LAUNCH_AGENT);
    // Also ensure immediate listen (launchd can be flaky on some setups)
  }

  // Always try a direct start if port is free
  const listening = isPortOpen(port);
  if (!listening) {
    const out = fs.openSync(LOG_FILE, 'a');
    const child = spawn(DAEMON_WRAPPER, [], {
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
  }

  await waitForPort(port, 12000);
  console.log(`✔ Proxy running at http://127.0.0.1:${port}`);
}

export async function stopService({ port = DEFAULT_PORT } = {}) {
  if (process.platform === 'darwin') {
    const uid = process.getuid?.() ?? os.userInfo().uid;
    try {
      launchctl('bootout', `gui/${uid}/com.jhih.codex-bridge`);
    } catch {
      // ignore
    }
  }
  try {
    const pids = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        // ignore
      }
    }
  } catch {
    // nothing listening
  }
  console.log('✔ Stopped');
}

export async function serviceStatus({ port = DEFAULT_PORT } = {}) {
  const state = loadState();
  const open = isPortOpen(port);
  console.log(`port ${port}: ${open ? 'listening' : 'down'}`);
  if (state) {
    console.log(`configured: ${state.configuredAt || state.updatedAt || 'yes'}`);
    console.log(`models: ${Object.values(state.models || {}).join(', ')}`);
  }
  if (open) {
    console.log(`endpoint: http://127.0.0.1:${port}/v1/messages`);
  }
}

function isPortOpen(port) {
  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPort(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isPortOpen(port)) return;
    await sleep(400);
  }
  throw new Error(`Proxy did not start on port ${port}. Check ${LOG_FILE}`);
}
