/**
 * 群内「帮助 / 新手指引」触发的简短说明（可原样转发飞书正文）。
 * 完整约定见仓库 `docs/CUSTOMER_GUIDE.md` 与 `docs/FEISHU_COMMANDS.md`。
 */
export const buildCustomerHelpFeishuReply = (): string =>
  [
    '【流水线机器人 · 指令说明】',
    '',
    '可用指令（发一条即可）：',
    '· **帮助** — 显示本说明',
    '· **状态** — 查看近期任务',
    '· **需求分析：**〈描述产品/功能需求〉— 生成结构化 PRD 要点（requirements-agent）',
    '· **编码：**〈要做的改动〉— 登记编码任务并给出摘要（coding-agent MVP 占位，不自动改代码）',
    '· **审核** — 对当前工作区跑代码审核（review-agent）',
    '· **全量测试** — 跑配置的全量测试（test-agent）',
    '',
    '一套编排将 需求 → 编码 → 审核 → 测试 → 发布 串起来；敏感操作（发包等）可能需验证码，见部署方 `docs/FEISHU_COMMANDS.md`。',
    '',
    '示例：「需求分析：B 端工单要支持按状态筛选」「编码：给登录页加记住我」',
  ].join('\n');
