# claude-gpt / codex-bridge

把 **OpenAI GPT API**（GPT 6.1 / 6.2 等）一键接到 **Claude Desktop** 与 **Claude Code**。

本地起一个 Anthropic 兼容代理 → Claude 走 Gateway → 实际请求打到你的 OpenAI Key。

> 本项目封装并开源了实战可用的部署流程（模型映射、GPT-6.x Responses API 兼容、macOS 开机自启、Desktop 模型选择器）。

---

## 一键安装（推荐）

```bash
export OPENAI_API_KEY='sk-...'
curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
```

没有先设环境变量也可以，安装脚本会提示你输入 Key：

```bash
curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
```

### 或用 npx

```bash
npx github:jhihhe/codex-bridge setup --api-key 'sk-...'
```

装完后：

1. **完全退出并重新打开** Claude Desktop  
2. 在模型列表选择：
   - `GPT 6.2 Astra` / `GPT 6.2 Sol` / `GPT 6.2 Sol Fast`
   - `GPT 6.1 Terra` / `GPT 6.1 Sol` / `GPT 6.1 Sol Fast`
3. 直接开聊

---

## 它做了什么

| 步骤 | 说明 |
|---|---|
| 安装 `claude-adapter` | Anthropic Messages API ↔ OpenAI |
| 写入 `~/.claude-adapter/config.json` | API Key、代理 Token、模型映射 |
| 打 GPT-6.x 兼容补丁 | Responses API / 模型路由 / `/v1/models` |
| 配置 Claude Code | `ANTHROPIC_BASE_URL=http://127.0.0.1:3080` |
| 配置 Claude Desktop Gateway | 模型选择器显示 GPT 6.1 / 6.2 |
| macOS LaunchAgent | 开机自动拉起本地代理 |

### 默认模型映射

| Claude 选择器 | 上游 OpenAI 模型 |
|---|---|
| GPT 6.2 Astra | `gpt-6.2-astra` |
| GPT 6.2 Sol | `gpt-6.2-sol` |
| GPT 6.2 Sol Fast | `gpt-6.2-sol` |
| GPT 6.1 Terra | `gpt-6.1-terra` |
| GPT 6.1 Sol | `gpt-6.1-sol` |
| GPT 6.1 Sol Fast | `gpt-6.1-sol` |

---

## 常用命令

```bash
npx codex-bridge status   # 看代理是否在跑
npx codex-bridge doctor   # 体检配置
npx codex-bridge stop     # 停止
npx codex-bridge start    # 启动
npx codex-bridge setup --api-key 'sk-...'   # 重新配置
```

默认端口：`3080`（可用 `CODEX_BRIDGE_PORT` 或 `--port` 修改）

---

## 要求

- macOS（Desktop Gateway / LaunchAgent 自动配置）  
  Linux / Windows 仍可把 Claude Code 指到本地代理，但 Desktop 配置需手动。
- Node.js 18+
- 可用的 OpenAI API Key（需能调用你映射的 GPT 模型）
- 已安装 Claude Desktop（第三方 Gateway / 3p 模式）或 Claude Code

---

## 安全说明

- API Key 只写在本机 `~/.claude-adapter/config.json`（权限随家目录）
- 本地代理默认监听 `127.0.0.1`
- **不要**把 Key 提交到 Git；Issue / PR 里也不要贴完整 Key
- 管理类 Admin Key（`sk-admin-...`）与对话用 Project Key 请分开

---

## 卸载

```bash
npx codex-bridge stop
rm -f ~/Library/LaunchAgents/com.jhih.codex-bridge.plist
rm -f ~/.local/bin/codex-bridge-daemon ~/.local/bin/codex-bridge
# 可选：删除配置
# rm -rf ~/.claude-adapter ~/.codex-bridge
```

---

## 开发

```bash
git clone https://github.com/jhihhe/codex-bridge.git
cd codex-bridge
npm install
node ./bin/codex-bridge.js setup --api-key "$OPENAI_API_KEY"
```

---

## English

**codex-bridge** is a one-click bridge that lets Claude Desktop / Claude Code talk to your **OpenAI GPT API** (including GPT 6.1 / 6.2) through a local Anthropic-compatible proxy.

```bash
export OPENAI_API_KEY='sk-...'
curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
```

Then restart Claude and pick `GPT 6.2 *` or `GPT 6.1 *` from the model picker.

---

## License

MIT © Jhih he

基于 [claude-adapter](https://www.npmjs.com/package/claude-adapter) 生态；本仓库提供部署、补丁与 Claude Desktop 集成脚本。
