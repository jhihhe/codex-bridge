#!/usr/bin/env bash
# claude-gpt/codex-bridge — one-line installer
set -euo pipefail

REPO="${CODEX_BRIDGE_REPO:-jhihhe/codex-bridge}"
BRANCH="${CODEX_BRIDGE_BRANCH:-main}"
DIR="${CODEX_BRIDGE_DIR:-$HOME/.codex-bridge/app}"

echo "→ Installing claude-gpt/codex-bridge into $DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install from https://nodejs.org and retry."
  exit 1
fi

mkdir -p "$(dirname "$DIR")"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$DIR"
  git clone --depth 1 --branch "$BRANCH" "https://github.com/${REPO}.git" "$DIR"
fi

cd "$DIR"
npm install --no-fund --no-audit

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  node ./bin/codex-bridge.js setup --api-key "$OPENAI_API_KEY" --yes
else
  node ./bin/codex-bridge.js setup
fi
