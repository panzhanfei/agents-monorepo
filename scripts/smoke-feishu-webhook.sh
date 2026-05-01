#!/usr/bin/env bash
# 本地冒烟：编排 + 飞书模拟 POST（需两服务已启动：dev-feishu-min 或等价）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORCH="${E2E_ORCHESTRATOR_URL:-http://127.0.0.1:4010}"
REQ="${REQUIREMENTS_AGENT_BASE_URL:-http://127.0.0.1:4060}"

echo "== GET $ORCH/health"
curl -sS "$ORCH/health" && echo "" || {
  echo "[fail] orchestrator 未响应。先运行: pnpm dev:feishu-min"
  exit 1
}
echo "== GET $REQ/health"
curl -sS "$REQ/health" && echo "" || {
  echo "[fail] requirements-agent 未响应。"
  exit 1
}

echo "== POST /feishu/webhook  你好"
curl -sS -X POST "$ORCH/feishu/webhook" \
  -H 'Content-Type: application/json' \
  -d '{"text":"你好"}' | head -c 600
echo ""
echo "== POST  @流水线 你好（扁平）"
curl -sS -X POST "$ORCH/feishu/webhook" \
  -H 'Content-Type: application/json' \
  -d '{"text":"@流水线 你好"}' | head -c 400
echo ""
echo "== done"
