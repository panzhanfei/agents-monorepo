#!/usr/bin/env bash
# 飞书事件体 → 编排器 → requirements-agent（Mock HTTP，无 LLM）全链路自测。
# 用法：pnpm verify:feishu:requirements
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORCH_PORT="${ORCHESTRATOR_PORT:-18010}"
MOCK_REQ_PORT="${MOCK_REQUIREMENTS_PORT:-18061}"
export MOCK_REQUIREMENTS_PORT="$MOCK_REQ_PORT"
ORCH_URL="${E2E_ORCHESTRATOR_URL:-http://127.0.0.1:${ORCH_PORT}}"
MOCK_URL="http://127.0.0.1:${MOCK_REQ_PORT}"

echo "━━━━━━━━ verify-feishu-requirements-chain ━━━━━━━━"

echo "== @agents/pipeline-core build"
pnpm --filter @agents/pipeline-core build

echo "== orchestrator build + test"
pnpm --filter orchestrator build
pnpm --filter orchestrator test

cleanup() {
  [[ -n "${MOCKPID:-}" ]] && kill "$MOCKPID" 2>/dev/null || true
  [[ -n "${ORCHPID:-}" ]] && kill "$ORCHPID" 2>/dev/null || true
  wait "$MOCKPID" 2>/dev/null || true
  wait "$ORCHPID" 2>/dev/null || true
}
trap cleanup EXIT

export AGENTS_MONOREPO_ROOT="$ROOT"
export ORCHESTRATOR_PORT="$ORCH_PORT"
export PORT="$ORCH_PORT"
export REQUIREMENTS_AGENT_BASE_URL="$MOCK_URL"
export REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS="${REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS:-30000}"
unset REQUIREMENTS_AGENT_INTERNAL_TOKEN || true
export TASK_STORE_DRIVER="${TASK_STORE_DRIVER:-memory}"
E2E_LOGDIR="$(mktemp -d)"
export AGENTS_LOG_DIR="$E2E_LOGDIR"
export AGENTS_LOG_DISABLE=0
export FEISHU_FLOW_TTY="${FEISHU_FLOW_TTY:-0}"

MOCKLOG="$(mktemp)"
ORCHLOG="$(mktemp)"

echo "== 启动 mock requirements :${MOCK_REQ_PORT}"
node "$ROOT/scripts/mock-requirements-http.mjs" >>"$MOCKLOG" 2>&1 &
MOCKPID=$!

echo "== 启动 orchestrator :${ORCH_PORT}"
node "$ROOT/apps/orchestrator/dist/index.js" >>"$ORCHLOG" 2>&1 &
ORCHPID=$!

wait_http() {
  local url="$1"
  local name="$2"
  local logf="$3"
  local i
  for i in $(seq 1 50); do
    if curl -sf "$url/health" >/dev/null 2>&1; then
      echo "   OK $name"
      return 0
    fi
    sleep 0.15
  done
  echo "[fail] $name 未就绪，日志:"
  cat "$logf"
  exit 1
}

wait_http "$MOCK_URL" "mock-requirements" "$MOCKLOG"
wait_http "$ORCH_URL" "orchestrator" "$ORCHLOG"

echo "== POST /feishu/webhook 飞书 event + 需求分析"
REQ_JSON='{"event":{"message":{"chat_id":"oc_e2e_chain","content":"{\"text\":\"需求分析：联调一句话\"}"}}}'
R_BODY="$(curl -sS -m 60 -X POST "$ORCH_URL/v1/feishu/webhook" \
  -H 'Content-Type: application/json' \
  -d "$REQ_JSON")"
echo "$R_BODY" | head -c 600
echo ""

echo "$R_BODY" | grep -q '"requirementsAnalysis"' || {
  echo "[fail] 响应应含 requirementsAnalysis"
  echo "--- orchestrator log ---"
  cat "$ORCHLOG"
  exit 1
}
echo "$R_BODY" | grep -q '# 产品需求（联调替身）' || {
  echo "[fail] 响应正文应含 mock 返回的 Markdown 标记（确认 REQ 指向 mock，而非本机 4060）"
  exit 1
}
echo "$R_BODY" | grep -q '"prdStatus"' || {
  echo "[fail] 响应应含 prdStatus"
  exit 1
}

ORCH_JSON_LOG="$E2E_LOGDIR/orchestrator.log"
[[ -f "$ORCH_JSON_LOG" ]] || {
  echo "[fail] 未生成 $ORCH_JSON_LOG"
  cat "$ORCHLOG"
  exit 1
}
grep -q '飞书 webhook 入口' "$ORCH_JSON_LOG" || {
  echo "[fail] orchestrator 落盘日志缺少「飞书 webhook 入口」"
  cat "$ORCH_JSON_LOG"
  exit 1
}
grep -q 'requirements_agent' "$ORCH_JSON_LOG" || {
  echo "[fail] orchestrator 落盘日志缺少 requirements_agent 步骤"
  cat "$ORCH_JSON_LOG"
  exit 1
}
grep -q 'mock_requirements_hit_analyze' "$MOCKLOG" || {
  echo "[fail] mock 未收到 /v1/requirements/analyze"
  cat "$MOCKLOG"
  exit 1
}

echo "━━━━━━━━ verify-feishu-requirements-chain OK ━━━━━━━━"
