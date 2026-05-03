#!/usr/bin/env bash
set -euo pipefail

# 编排器直连（等同 Agent Console → /v1/mock-feishu）：需求分析 → 引用锚点 → 编码
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORCH="${AGENTS_ORCHESTRATOR_URL:-http://127.0.0.1:4010}"
ORCH="${ORCH%/}"
ANCHOR="${SMOKE_QUOTE_ANCHOR:-quote-anchor-smoke-$(date +%s)}"
ATTACH="$ROOT/.agents/smoke-interview/resume-excerpt-from-pdf.txt"

if [[ ! -f "$ATTACH" ]]; then
  echo "missing attachment file: $ATTACH" >&2
  exit 1
fi

echo ">>> ORCH=$ORCH ANCHOR=$ANCHOR"

REQ_TEXT=$'需求分析：做一个个人网站；SEO 良好；静态页面；Next.js + TypeScript；赛博朋克 UI、简约大气。\n首页展示个人简历摘要、工作经历与项目案例（素材见附件 PDF 抽取文本）。请产出结构化 PRD 与验收标准。'

REQ_JSON="$(jq -n \
  --arg text "$REQ_TEXT" \
  --arg anchor "$ANCHOR" \
  --rawfile excerpt "$ATTACH" \
  '{
    text: $text,
    channelId: "agent-console",
    metadata: {
      agentsPipelineInboundKind: "agent_console",
      consoleTargetProjectId: "default",
      consolePrdReplyAnchorId: $anchor,
      consoleRequirementsAttachments: {
        textFiles: [
          { name: "潘展飞.pdf.txt", content: $excerpt }
        ]
      }
    }
  }')"

echo ">>> POST 需求分析 …"
REQ_OUT="$(curl -sS --max-time 600 -X POST "$ORCH/v1/mock-feishu" \
  -H 'Content-Type: application/json' \
  -d "$REQ_JSON")"

echo "$REQ_OUT" | jq '{ok, taskId: .task.taskId, status: .task.status, code}' 2>/dev/null || echo "$REQ_OUT"

TASK_ID="$(echo "$REQ_OUT" | jq -r '.task.taskId // empty')"
if [[ -z "$TASK_ID" || "$TASK_ID" == "null" ]]; then
  echo "需求分析未返回 taskId，中止。" >&2
  exit 1
fi

CODE_JSON="$(jq -n \
  --arg anchor "$ANCHOR" \
  '{
    text: "编码：按本条引用关联的 PRD（需求分析与附件摘要）在目标仓库落地 Next.js SSG 个人站：赛博朋克简约风、SEO（metadata、sitemap 若适用）、主页含简历/经历/项目区块；勿脱离 PRD 擅自改需求范围。",
    channelId: "agent-console",
    parentMessageId: $anchor,
    metadata: {
      agentsPipelineInboundKind: "agent_console",
      consoleTargetProjectId: "default"
    }
  }')"

echo ">>> POST 编码（引用锚点=$ANCHOR）…"
CODE_OUT="$(curl -sS --max-time 600 -X POST "$ORCH/v1/mock-feishu" \
  -H 'Content-Type: application/json' \
  -d "$CODE_JSON")"

echo "$CODE_OUT" | jq '{ok, taskId: .task.taskId, accepted: .coding.accepted, status: .task.status}' 2>/dev/null || echo "$CODE_OUT"

ACC="$(echo "$CODE_OUT" | jq -r '.coding.accepted // false')"
if [[ "$ACC" != "true" ]]; then
  echo "编码未 accepted=false 或未返回；请查看上文 JSON。" >&2
  exit 1
fi

echo ">>> 完成：需求任务=$TASK_ID；编码任务=$(echo "$CODE_OUT" | jq -r '.task.taskId')"
