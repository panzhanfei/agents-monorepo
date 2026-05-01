/**
 * 群内「帮助 / 新手指引」触发的简短说明（可原样转发飞书正文）。
 * 完整约定见仓库 `docs/CUSTOMER_GUIDE.md` 与 `docs/FEISHU_COMMANDS.md`。
 */
export const buildCustomerHelpFeishuReply = (): string =>
  [
    '【Agent 流水线 · 新手指引】',
    '',
    '一套编排（orchestrator）按顺序调度 5 类专属 Agent，把「说的话」变成「能上线的改动」。',
    '1）需求分析：口头/群聊需求 → 结构化 PRD、验收与风险（requirements-agent）。',
    '2）编码：在绑定的工作区改代码（coding-agent）。',
    '3）审核：工具链门禁 + 规则/AI 评审（review-agent）。',
    '4）测试：按配置跑全量测试并汇总报告（test-agent）。',
    '5）发包/巡检：构建、发布、只读巡检等（ops-agent；敏感操作常需验证码）。',
    '',
    '建议首次顺序：绑定工作区（若新项目）→ 需求分析 → 编码 → 审核 → 全量测试；发布前确认环境已按部署方文档配置。',
    '',
    '发「状态」可查看近期任务；详细句式与验证码规则请见部署方提供的飞书指令表（docs/FEISHU_COMMANDS.md）。',
  ].join('\n');
