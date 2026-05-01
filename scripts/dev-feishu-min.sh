#!/usr/bin/env bash
# 飞书联调最小集合：编排 + 需求分析（「你好 / 帮助 / 需求分析」）。
# 不含 ngrok —— 飞书公网打不进来；要隧道请用：pnpm dev:feishu-min:ngrok
# 仅跑 review-agent 不会出现任何飞书日志——消息入口在 orchestrator。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "dev:feishu-min — orchestrator + requirements-agent"
echo ""
echo "飞书公网需隧道请用: pnpm dev:feishu-min:ngrok（本脚本不启动 ngrok）。"
echo "群里要有回复：连接器需把响应 JSON 里的 feishuReplyText 用飞书「发消息」API 发回（仅 HTTP 200 不会自动出现在聊天）。"
echo "若事件加密：入口日志会有 hasEncrypt:true，需解密后再转编排器。"
echo "另一终端请运行   : pnpm logs（聚合 logs/*.log，全服务 JSON 流转）"
echo "本终端搜         : [orchestrator:feishu] …"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm exec turbo run dev --filter=orchestrator --filter=requirements-agent
