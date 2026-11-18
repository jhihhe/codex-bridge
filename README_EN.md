<!-- readme-visuals:header:start -->
<p align="center"><img src="https://raw.githubusercontent.com/jhihhe/codex-bridge/main/readme-assets/banner.png" alt="codex-bridge — One-click OpenAI GPT API bridge for Claude Desktop and Claude Code" width="100%"></p>

<p align="center">
  <a href="https://github.com/jhihhe/codex-bridge/commits/main"><img src="https://img.shields.io/github/last-commit/jhihhe/codex-bridge?style=flat-square&amp;color=38bdf8" alt="Last commit"></a>
  <a href="https://github.com/jhihhe/codex-bridge/stargazers"><img src="https://img.shields.io/github/stars/jhihhe/codex-bridge?style=flat-square&amp;color=38bdf8" alt="GitHub stars"></a>
  <a href="https://github.com/jhihhe/codex-bridge/issues"><img src="https://img.shields.io/github/issues/jhihhe/codex-bridge?style=flat-square&amp;color=38bdf8" alt="Issues"></a>
  <a href="https://github.com/jhihhe"><img src="https://img.shields.io/badge/Maintainer-%40Jhih%20he-38bdf8?style=flat-square" alt="Maintainer: @Jhih he"></a>
</p>
<!-- readme-visuals:header:end -->

<div align="center">

# 🌉 claude-gpt / codex-bridge

**One-click OpenAI GPT API bridge for Claude Desktop & Claude Code**  
*把 OpenAI GPT API 一键接到 Claude Desktop 与 Claude Code*

<p>
  <a href="./README.md">简体中文</a> · <b>English</b>
</p>

<p>
  <img src="https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Platform-macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Platform">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/OpenAI-GPT%206.1%20%2F%206.2-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI">
  <img src="https://img.shields.io/badge/Claude-Desktop%20%2B%20Code-d97706?style=for-the-badge" alt="Claude">
</p>

<p>
  <img src="https://img.shields.io/badge/Proxy-127.0.0.1%3A3080-38bdf8?style=flat-square" alt="Proxy">
  <img src="https://img.shields.io/badge/Gateway-Anthropic%20Compatible-34d399?style=flat-square" alt="Gateway">
  <img src="https://img.shields.io/badge/Autostart-LaunchAgent-fbbf24?style=flat-square" alt="Autostart">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome">
</p>

</div>

---

<!-- readme-visuals:overview:start -->

## Overview

<table>
<tr>
<td width="33%" valign="top"><strong>Drop in an API key</strong><br><br>One command writes local config — secrets never go into the repo.</td>
<td width="33%" valign="top"><strong>Local Anthropic gateway</strong><br><br>Translates Claude requests into OpenAI Chat / Responses API calls.</td>
<td width="33%" valign="top"><strong>Model picker ready</strong><br><br>Pick GPT 6.1 / 6.2 in Desktop; the proxy autostarts on login.</td>
</tr>
</table>

### Flow

```mermaid
flowchart LR
    S0["Set OPENAI_API_KEY"] --> S1
    S1["Install + patch"] --> S2
    S2["Start 127.0.0.1:3080"] --> S3
    S3["Choose a GPT model in Claude"]
```

<!-- readme-visuals:overview:end -->

## 📸 Architecture

<p align="center">
  <img src="https://raw.githubusercontent.com/jhihhe/codex-bridge/main/readme-assets/architecture.svg?v=2" alt="Architecture: Claude to codex-bridge to OpenAI" width="100%">
</p>

```text
Claude Desktop / Claude Code
        │  Anthropic Messages API
        ▼
codex-bridge  (claude-adapter + GPT-6.x patches)
  http://127.0.0.1:3080
        │  OpenAI API
        ▼
OpenAI  GPT 6.1 / GPT 6.2   ← your sk-…
```

---

## ✨ Features

- ⚡ **One-click setup** via `curl | bash` or `npx`
- 🧠 **GPT 6.1 / 6.2** routes exposed in Claude’s model picker
- 🧩 **Compatibility patches** for Responses API, token limits, and `/v1/models`
- 🖥️ **Claude Desktop Gateway** auto-config for 3p `configLibrary`
- ⌨️ **Claude Code** env wiring (`ANTHROPIC_BASE_URL` / token)
- 🚀 **macOS LaunchAgent** so the proxy survives reboots
- 🩺 **doctor** command to verify proxy, config, and model list

### Default model map

| Picker label | Route ID | Upstream OpenAI model |
|---|---|---|
| GPT 6.2 Astra | `claude-opus-4-5` | `gpt-6.2-astra` |
| GPT 6.2 Sol | `claude-sonnet-4-5` | `gpt-6.2-sol` |
| GPT 6.2 Sol Fast | `claude-haiku-4-5` | `gpt-6.2-sol` |
| GPT 6.1 Terra | `claude-opus-4-1` | `gpt-6.1-terra` |
| GPT 6.1 Sol | `claude-sonnet-4-1` | `gpt-6.1-sol` |
| GPT 6.1 Sol Fast | `claude-haiku-4-1` | `gpt-6.1-sol` |

---

## 🚀 Install

### Recommended

```bash
export OPENAI_API_KEY='sk-...'
curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
```

Without an env var, the script prompts for the key:

```bash
curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
```

### Or use npx

```bash
npx github:jhihhe/codex-bridge setup --api-key 'sk-...'
```

### After install

1. **Fully quit and reopen** Claude Desktop  
2. Pick `GPT 6.2 *` or `GPT 6.1 *` in the model list  
3. Start chatting  

---

## 🧰 Commands

```bash
npx codex-bridge status
npx codex-bridge doctor
npx codex-bridge stop
npx codex-bridge start
npx codex-bridge setup --api-key 'sk-...'
npx codex-bridge patch
```

| Item | Default |
|---|---|
| Port | `3080` (`CODEX_BRIDGE_PORT` / `--port`) |
| Adapter config | `~/.claude-adapter/config.json` |
| Log | `~/Library/Logs/codex-bridge.log` |
| LaunchAgent | `~/Library/LaunchAgents/com.jhih.codex-bridge.plist` |

---

## 📦 What setup does

| Step | Detail |
|---|---|
| Install `claude-adapter@2.2.1` | Anthropic ↔ OpenAI translation |
| Write `~/.claude-adapter/config.json` | API key, proxy token, model map |
| Apply GPT-6.x patches | Responses bridge, routes, `/v1/models` |
| Configure Claude Code | `ANTHROPIC_BASE_URL=http://127.0.0.1:3080` |
| Configure Claude Desktop | Gateway + picker labels |
| Install LaunchAgent | Autostart local proxy |

---

## ✅ Requirements

- **macOS** for automatic Desktop Gateway / LaunchAgent setup  
  Linux / Windows can still point Claude Code at the local proxy
- **Node.js 18+**
- A working **OpenAI API key** for the mapped models
- **Claude Desktop** (Gateway / 3p mode) and/or **Claude Code**

---

## 🔐 Security

- API keys stay on-disk in `~/.claude-adapter/config.json`
- Proxy binds to `127.0.0.1` by default
- Never commit keys or paste full secrets into issues/PRs
- Keep chat Project keys (`sk-proj-…`) separate from Admin keys (`sk-admin-…`)

---

## 🧹 Uninstall

```bash
npx codex-bridge stop
rm -f ~/Library/LaunchAgents/com.jhih.codex-bridge.plist
rm -f ~/.local/bin/codex-bridge-daemon ~/.local/bin/codex-bridge
# optional: rm -rf ~/.claude-adapter ~/.codex-bridge
```

---

## 🛠️ Development

```bash
git clone https://github.com/jhihhe/codex-bridge.git
cd codex-bridge
npm install
node ./bin/codex-bridge.js setup --api-key "$OPENAI_API_KEY"
node ./bin/codex-bridge.js doctor
```

---

## 📄 License

[MIT](./LICENSE) © [@Jhih he](https://github.com/jhihhe)

Built around the [claude-adapter](https://www.npmjs.com/package/claude-adapter) ecosystem, with deploy scripts, compatibility patches, and Claude Desktop integration.

---

<div align="center">

**Made with ☕ by [@Jhih he](https://github.com/jhihhe)**

[中文 README](./README.md) · [Issues](https://github.com/jhihhe/codex-bridge/issues) · [Stars](https://github.com/jhihhe/codex-bridge/stargazers)

</div>
