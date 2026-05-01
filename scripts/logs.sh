#!/usr/bin/env bash
# 聚合「全项目」JSON 日志：各服务在开发环境下写入 $AGENTS_LOG_DIR（默认仓库 logs/），本脚本 tail -f 所有 *.log
# 用法：终端 1 跑 pnpm dev；终端 2 跑 pnpm logs（或 pnpm logs all）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

resolve_log_dir() {
  if [[ -n "${AGENTS_LOG_DIR:-}" ]]; then
    echo "$AGENTS_LOG_DIR"
    return
  fi
  if [[ -f ".env" ]]; then
    local line
    line="$(grep -E '^[[:space:]]*AGENTS_LOG_DIR=' .env 2>/dev/null | tail -n1 || true)"
    if [[ -n "$line" ]]; then
      local v="${line#*=}"
      v="${v%%$'\r'}"
      v="$(echo "$v" | sed -e 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^[\"'\'']//;s/[\"'\'']$//')"
      if [[ -n "$v" ]]; then
        echo "$v"
        return
      fi
    fi
  fi
  echo "./logs"
}

LOG_DIR="$(resolve_log_dir)"
if [[ "$LOG_DIR" != /* ]]; then
  LOG_DIR="$ROOT_DIR/$LOG_DIR"
fi

cmd="${1:-all}"
WAIT_MAX_SEC="${LOGS_WAIT_SEC:-90}"

usage() {
  echo "用法: pnpm logs [all|<service>|ngrok|help]"
  echo "  all（默认）  tail -f 聚合目录下所有 *.log（与「流转」JSON + orchestrator 飞书步骤同一源）"
  echo "  <service>    只跟踪 logs/<service>.log（与 createLogger 的 service 名一致，如 orchestrator）"
  echo "  ngrok        仅 .ngrok.log"
  echo "  help         本说明"
  echo ""
  echo "开发默认写入: 仓库根目录 logs/（未设置 AGENTS_LOG_DIR 且非 production 时自动；test 不落盘）。"
  echo "关闭文件日志: 环境变量 AGENTS_LOG_DISABLE=1"
}

wait_for_any_log() {
  local i=0
  while (( i < WAIT_MAX_SEC )); do
    shopt -s nullglob
    local files=("$LOG_DIR"/*.log)
    shopt -u nullglob
    if ((${#files[@]} > 0)); then
      return 0
    fi
    if (( i == 0 )); then
      echo "[info] 等待 $LOG_DIR/*.log（请先另开终端跑 pnpm dev，最多 ${WAIT_MAX_SEC}s）…"
    fi
    sleep 1
    ((i += 1)) || true
  done
  return 1
}

wait_for_one_log() {
  local target="$1"
  local i=0
  while (( i < WAIT_MAX_SEC )); do
    if [[ -f "$target" ]]; then
      return 0
    fi
    if (( i == 0 )); then
      echo "[info] 等待 $target（先 pnpm dev，最多 ${WAIT_MAX_SEC}s）…"
    fi
    sleep 1
    ((i += 1)) || true
  done
  return 1
}

case "$cmd" in
  -h | --help | help)
    usage
    exit 0
    ;;
  ngrok)
    if [[ ! -f "$ROOT_DIR/.ngrok.log" ]]; then
      echo "[info] 无 $ROOT_DIR/.ngrok.log"
      exit 1
    fi
    tail -n 80 -f "$ROOT_DIR/.ngrok.log"
    ;;
  all | "")
    mkdir -p "$LOG_DIR"
    if ! wait_for_any_log; then
      echo "[warn] 超时仍无日志。确认已 pnpm dev、NODE_ENV 非 test；或设置 AGENTS_LOG_DIR=$LOG_DIR"
      exit 1
    fi
    shopt -s nullglob
    files=("$LOG_DIR"/*.log)
    shopt -u nullglob
    echo "[info] 跟踪 ${#files[@]} 个文件: ${files[*]##*/}"
    tail -n 30 -f "${files[@]}"
    ;;
  *)
    f="$LOG_DIR/${cmd}.log"
    mkdir -p "$LOG_DIR"
    if ! wait_for_one_log "$f"; then
      echo "[warn] 仍无 $f，检查 service 名与进程是否已写 logger_ready"
      exit 1
    fi
    tail -n 80 -f "$f"
    ;;
esac
