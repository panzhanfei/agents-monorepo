#!/usr/bin/env bash
# 飞书入口 + 需求分析链路一键验证（build → 单测 → 短时起进程 → HTTP 冒烟）。
# 不依赖 pnpm dev watch；CI / 改完代码自测用。
# 需求分析全链路（调 LLM）默认跳过；要测：`SMOKE_REQUIREMENTS_FULL=1 pnpm verify:feishu`
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORCH_PORT="${ORCHESTRATOR_PORT:-4010}"
REQ_PORT="${REQUIREMENTS_AGENT_PORT:-4060}"
ORCH_URL="${E2E_ORCHESTRATOR_URL:-http://127.0.0.1:${ORCH_PORT}}"
REQ_URL="${REQUIREMENTS_AGENT_BASE_URL:-http://127.0.0.1:${REQ_PORT}}"

echo "━━━━━━━━ verify-feishu-flow ━━━━━━━━"

echo "== @agents/pipeline-core build"
pnpm --filter @agents/pipeline-core build

echo "== requirements-agent build + test"
pnpm --filter requirements-agent build
pnpm --filter requirements-agent test

echo "== orchestrator build + test"
pnpm --filter orchestrator build
pnpm --filter orchestrator test

cleanup() {
  [[ -n "${REQPID:-}" ]] && kill "$REQPID" 2>/dev/null || true
  [[ -n "${ORCHPID:-}" ]] && kill "$ORCHPID" 2>/dev/null || true
  wait "$REQPID" 2>/dev/null || true
  wait "$ORCHPID" 2>/dev/null || true
}
trap cleanup EXIT

export AGENTS_MONOREPO_ROOT="$ROOT"
export REQUIREMENTS_AGENT_PORT="$REQ_PORT"
export ORCHESTRATOR_PORT="$ORCH_PORT"
export PORT="$ORCH_PORT"
export REQUIREMENTS_AGENT_BASE_URL="$REQ_URL"
export REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS="${REQUIREMENTS_AGENT_HTTP_TIMEOUT_MS:-180000}"
export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:11434/v1}"
export LLM_MODEL="${LLM_MODEL:-qwen2.5:14b}"
export REQUIREMENTS_LLM_MODEL="${REQUIREMENTS_LLM_MODEL:-$LLM_MODEL}"
export TASK_STORE_DRIVER="${TASK_STORE_DRIVER:-memory}"
# 脚本输出不刷 tee 行
export FEISHU_FLOW_TTY="${FEISHU_FLOW_TTY:-0}"

REQLOG="$(mktemp)"
ORCHLOG="$(mktemp)"

echo "== 启动 requirements-agent :${REQ_PORT}"
node "$ROOT/apps/requirements-agent/dist/index.js" >>"$REQLOG" 2>&1 &
REQPID=$!

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

wait_http "$REQ_URL" "requirements-agent" "$REQLOG"
wait_http "$ORCH_URL" "orchestrator" "$ORCHLOG"

echo "== POST /feishu/webhook  你好"
H_BODY="$(curl -sS -X POST "$ORCH_URL/feishu/webhook" \
  -H 'Content-Type: application/json' \
  -d '{"text":"你好"}')"
echo "$H_BODY" | head -c 400
echo ""
echo "$H_BODY" | grep -q '"ok":true' || {
  echo "[fail] 期望 ok:true（帮助）"
  exit 1
}

echo "== POST 飞书 event.message.content"
E_BODY="$(curl -sS -X POST "$ORCH_URL/feishu/webhook" \
  -H 'Content-Type: application/json' \
  -d '{"event":{"message":{"chat_id":"oc_smoke","content":"{\"text\":\"帮助\"}"}}}')"
echo "$E_BODY" | head -c 400
echo ""
echo "$E_BODY" | grep -q '"ok":true' || {
  echo "[fail] 事件体解析"
  exit 1
}

if [[ "${SMOKE_REQUIREMENTS_FULL:-}" == "1" ]]; then
  echo "== POST 需求分析（SMOKE_REQUIREMENTS_FULL=1，可能较慢）"
  R_BODY="$(curl -sS -m "${SMOKE_REQUIREMENTS_CURL_SEC:-180}" -X POST "$ORCH_URL/feishu/webhook" \
    -H 'Content-Type: application/json' \
    -d '{"text":"需求分析：冒烟一句话，输出最简 PRD 小节即可"}')"
  echo "$R_BODY" | head -c 500
  echo ""
  echo "$R_BODY" | grep -q '"requirementsAnalysis"' || {
    echo "[fail] 需求分析未返回 requirementsAnalysis"
    exit 1
  }
fi

echo "━━━━━━━━ verify-feishu-flow OK ━━━━━━━━"
