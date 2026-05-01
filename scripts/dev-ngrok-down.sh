#!/usr/bin/env bash
# 仅结束由 dev-with-ngrok.sh 写入 .ngrok.pid 的 ngrok 进程。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGROK_PID_FILE="$ROOT_DIR/.ngrok.pid"

if [[ ! -f "$NGROK_PID_FILE" ]]; then
  echo "[info] no $NGROK_PID_FILE; nothing to stop"
  exit 0
fi

PID="$(cat "$NGROK_PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  rm -f "$NGROK_PID_FILE"
  exit 0
fi

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  echo "[ok] stopped ngrok (pid $PID)"
else
  echo "[info] pid $PID not running"
fi
rm -f "$NGROK_PID_FILE"
