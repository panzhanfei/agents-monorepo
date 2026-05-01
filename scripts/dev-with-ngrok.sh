#!/usr/bin/env bash
# 一键：先起 ngrok（指向 orchestrator 端口），再前台运行 dev。
# 用法（仓库根目录）：
#   ./scripts/dev-with-ngrok.sh           → pnpm exec turbo run dev（等同原 pnpm dev）
#   ./scripts/dev-with-ngrok.sh orchestrator → 仅 orchestrator（轻量）
#   ./scripts/dev-with-ngrok.sh feishu-min   → ngrok + orchestrator + requirements-agent（飞书联调最小集）
# 环境变量：ORCHESTRATOR_PORT（默认读 .env 或 4010）、NGROK_POOLING=0 关闭 --pooling-enabled
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGROK_LOG="$ROOT_DIR/.ngrok.log"
NGROK_PID_FILE="$ROOT_DIR/.ngrok.pid"
DEV_TARGET="${1:-turbo}"

cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "[error] .env not found in $ROOT_DIR (copy from .env.example)"
  exit 1
fi

resolve_port() {
  local p="${ORCHESTRATOR_PORT:-${PORT:-}}"
  if [[ -z "$p" ]] && [[ -f "$ROOT_DIR/.env" ]]; then
    local line
    line="$(grep -E '^[[:space:]]*ORCHESTRATOR_PORT=' "$ROOT_DIR/.env" 2>/dev/null | tail -n1 || true)"
    if [[ -n "$line" ]]; then
      p="${line#*=}"
      p="${p%%$'\r'}"
      p="$(echo "$p" | sed -e 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^["'\'']//;s/["'\'']$//')"
    fi
  fi
  echo "${p:-4010}"
}

PORT="$(resolve_port)"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "[error] ngrok not found. Install from https://ngrok.com/download then: ngrok config add-authtoken <token>"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[error] pnpm not found."
  exit 1
fi

stop_ngrok() {
  if [[ -f "$NGROK_PID_FILE" ]]; then
    local old_pid
    old_pid="$(cat "$NGROK_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
      kill "${old_pid}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$NGROK_PID_FILE"
  fi
}

cleanup_on_exit() {
  stop_ngrok
}

trap cleanup_on_exit EXIT INT TERM

echo "[1/4] Starting ngrok tunnel -> http://127.0.0.1:${PORT} ..."

stop_ngrok

ngrok_cmd_args=(http "$PORT")
if [[ "${NGROK_POOLING:-1}" != "0" ]]; then
  ngrok_cmd_args+=(--pooling-enabled)
fi

nohup ngrok "${ngrok_cmd_args[@]}" >"$NGROK_LOG" 2>&1 &
echo $! >"$NGROK_PID_FILE"
sleep 2

if ! kill -0 "$(cat "$NGROK_PID_FILE")" 2>/dev/null; then
  echo "[error] ngrok failed to start. See $NGROK_LOG"
  if [[ -f "$NGROK_LOG" ]] && grep -q "unknown flag" "$NGROK_LOG" 2>/dev/null; then
    echo "[hint] Retry with: NGROK_POOLING=0 $0"
  fi
  exit 1
fi

ngrok_https_url() {
  local raw
  raw="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null || true)"
  if [[ -z "$raw" ]]; then
    echo ""
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$raw" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(next((t.get("public_url","") for t in d.get("tunnels",[]) if t.get("proto")=="https"), ""))' 2>/dev/null || true
    return 0
  fi
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$raw" | jq -r '.tunnels[]? | select(.proto=="https") | .public_url' 2>/dev/null | head -n1 || true
    return 0
  fi
  echo ""
}

echo "[2/4] Resolving ngrok public URL (local agent :4040) ..."
PUBLIC_URL=""
for _attempt in 1 2 3 4 5 6 7 8; do
  PUBLIC_URL="$(ngrok_https_url)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 1
done

echo "[3/4] (orchestrator 将由 dev 任务拉起；必要时稍后再探活 /health)"
if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "Local health: already OK (http://127.0.0.1:${PORT}/health)"
fi

if [[ "$DEV_TARGET" == "orchestrator" ]]; then
  echo "[4/4] Starting orchestrator only (Ctrl+C stops ngrok) ..."
elif [[ "$DEV_TARGET" == "feishu-min" ]]; then
  echo "[4/4] Starting orchestrator + requirements-agent (Ctrl+C stops ngrok) ..."
else
  echo "[4/4] Starting monorepo: pnpm exec turbo run dev (Ctrl+C stops ngrok) ..."
fi

echo "=============================="
echo "Orchestrator local : http://127.0.0.1:${PORT}"
if [[ -n "$PUBLIC_URL" ]]; then
  echo "Public HTTPS      : ${PUBLIC_URL}"
  echo "Health (public)   : ${PUBLIC_URL}/health"
  echo "飞书 Webhook (v1) : ${PUBLIC_URL}/v1/feishu/webhook"
  echo "飞书 Webhook      : ${PUBLIC_URL}/feishu/webhook"
else
  echo "Public HTTPS      : (not resolved — see $NGROK_LOG ; UI http://127.0.0.1:4040)"
fi
echo "ngrok log         : $NGROK_LOG"
echo "Stop ngrok only  : ./scripts/dev-ngrok-down.sh"
echo "Sans ngrok       : pnpm dev:no-tunnel"
echo "聚合流转日志     : 另开终端 pnpm logs（tail logs/*.log）；仅 ngrok: pnpm logs ngrok"
echo "=============================="
echo ""

if [[ "$DEV_TARGET" == "orchestrator" ]]; then
  pnpm --filter orchestrator dev
elif [[ "$DEV_TARGET" == "feishu-min" ]]; then
  pnpm exec turbo run dev --filter=orchestrator --filter=requirements-agent
else
  pnpm exec turbo run dev
fi
