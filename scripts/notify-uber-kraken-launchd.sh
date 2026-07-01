#!/bin/bash
#
# launchd から定期実行される UberUberクラーケン クリア通知ラッパー。
#
# Discord Webhook URL などの秘密情報は、リポジトリに含めず
#   ~/.lootdive-notify.env
# に `DISCORD_WEBHOOK_URL=...` の形で記述しておく（git管理外）。
#
# 手動実行での動作確認:
#   bash scripts/notify-uber-kraken-launchd.sh
#
set -euo pipefail

# nodenv(shim) を含む最小 PATH。launchd はログインシェルの環境を引き継がないため明示する。
export PATH="/Users/astapi/.anyenv/envs/nodenv/shims:/usr/local/bin:/usr/bin:/bin"

# 秘密情報を読み込む
ENV_FILE="$HOME/.lootdive-notify.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# このスクリプトの位置からプロジェクトルートを解決（パスのハードコードを避ける）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify:uber-kraken start"
npm run --silent notify:uber-kraken
echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify:uber-kraken done"
