#!/usr/bin/env bash
# 本地一键启动：无 ngrok，turbo 并行拉起各 app 的 dev（含 agent-console 双进程）。
# 用法：仓库根目录  pnpm exec turbo run dev
# （本脚本只做启动前端口提示；无 ngrok）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pick_env() {
  local key="$1"
  local def="$2"
  local line v
  if [[ -f "$ROOT_DIR/.env" ]]; then
    line="$(grep -E "^[[:space:]]*${key}=" "$ROOT_DIR/.env" 2>/dev/null | tail -n1 || true)"
    if [[ -n "$line" ]]; then
      v="${line#*=}"
      v="${v%%$'\r'}"
      v="$(echo "$v" | sed -e 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^["'\'']//;s/["'\'']$//')"
      if [[ -n "$v" ]]; then
        echo "$v"
        return 0
      fi
    fi
  fi
  echo "$def"
}

O_PORT="$(pick_env ORCHESTRATOR_PORT 4010)"
C_VITE="$(pick_env AGENT_CONSOLE_VITE_PORT 5275)"
C_API="$(pick_env AGENT_CONSOLE_API_PORT 5280)"
CODING="$(pick_env CODING_AGENT_PORT 4020)"
REVIEW="$(pick_env REVIEW_AGENT_PORT 4030)"
REQ="$(pick_env REQUIREMENTS_AGENT_PORT 4060)"
TESTP="$(pick_env TEST_AGENT_PORT 4041)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  agents-monorepo — 一键本地 dev（pnpm exec turbo run dev）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Orchestrator    http://127.0.0.1:${O_PORT}"
echo "  Agent Console    http://127.0.0.1:${C_VITE}"
echo "  Console API      http://127.0.0.1:${C_API}"
echo "  coding-agent     http://127.0.0.1:${CODING}"
echo "  review-agent     http://127.0.0.1:${REVIEW}"
echo "  requirements     http://127.0.0.1:${REQ}"
echo "  test-agent       http://127.0.0.1:${TESTP}"
echo "  聚合日志（另开终端）: pnpm logs"
echo "  飞书公网隧道入口     : pnpm dev （需 ngrok + .env）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm exec turbo run dev
