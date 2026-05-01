import type { ITargetProjectEntry } from '@agents/agents-config';

export const buildConfiguredTargetsBulletLines = (
  ps: readonly ITargetProjectEntry[]
): string =>
  ps
    .map((p) => `• ${p.id}${p.label !== undefined ? ` — ${p.label}` : ''}`)
    .join('\n');

export const buildAmbiguousTargetFeishuReply = (
  ps: readonly ITargetProjectEntry[]
): string =>
  [
    '已启用多目标项目（`agents.config.yaml` 的 `target.projects`），但当前会话尚未选定要操作的仓库。',
    '',
    '已配置：',
    buildConfiguredTargetsBulletLines(ps),
    '',
    '请先发送（会话内绑定，下同）：',
    '切换目标：<上面列表中的 id>',
    '',
    '也可仅用本条消息指定仓库（不写则沿用已绑定或环境变量默认值）：在第一行单独写 ',
    '`目标：<id>`',
    '，第二行起写「编码 / 审核 / 全量测试」正文。',
    '',
    '默认值顺序（多目标且无首行）：本会话绑定 → `TARGET_DEFAULT_PROJECT_ID` → `target.defaultProjectId`。仅配置**一个** `projects` 条目时会自动使用该条目。',
  ].join('\n');
