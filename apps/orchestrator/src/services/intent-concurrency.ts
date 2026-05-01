import type { ITaskRecord } from '@agents/pipeline-core';

/** 与 docs/FEISHU_COMMANDS 内部 action 对齐，用于对用户可见文案。 */
export const ACTION_LABEL_ZH: Record<string, string> = {
  code: '编码',
  requirements_analysis: '需求分析',
  review: '代码审核',
  test: '全量测试',
  publish: '发包',
  full_release: '一键发布',
  rollback: '回滚',
  probe: '服务器巡检',
  change_workspace_binding: '绑定工作区',
  git_remote_override: '设置远端仓库',
  change_review_rules: '修改审核策略',
  change_deploy_target: '修改部署目标',
  status: '查询状态',
  cancel: '取消任务',
  workflow_continue: '继续流程',
  workflow_pause: '暂停流程',
  help: '新手指引',
};

export const actionLabelZh = (action: string): string =>
  ACTION_LABEL_ZH[action] ?? action;

/** 不创建独占型「作业任务」、不做同动作并发拦截（仍可能走别的逻辑）。 */
export const ACTIONS_SKIP_CONCURRENCY_GUARD = new Set([
  'status',
  'help',
  'cancel',
  'workflow_continue',
  'workflow_pause',
]);

/**
 * 从飞书/模拟消息正文解析内部 action；粗粒度关键词，后续可换结构化指令。
 * 顺序：先匹配更长、更具体的短语，避免误伤。
 */
export const parseIntentFromMessage = (text: string): string | null => {
  const t = text.trim();
  if (t === '') {
    return null;
  }
  if (
    /^(?:帮助|新手指引|新手入门|使用说明)\s*$|^help\s*$/i.test(t) ||
    /^指令[:：]\s*(?:帮助|新手指引|新手入门)\s*$/i.test(t) ||
    /^agent\s*指南\s*$/i.test(t)
  ) {
    return 'help';
  }
  if (/一键(?:发布|测试打包发包)|full_release/i.test(t)) {
    return 'full_release';
  }
  if (/需求分析|PRD|requirements_analysis/i.test(t)) {
    return 'requirements_analysis';
  }
  if (/全量测试|^\s*测试[:：]|指令[:：]\s*全量/i.test(t)) {
    return 'test';
  }
  if (/审核|review/i.test(t)) {
    return 'review';
  }
  if (/发包|发布|publish/i.test(t)) {
    return 'publish';
  }
  if (/回滚|rollback/i.test(t)) {
    return 'rollback';
  }
  if (/巡检|probe/i.test(t)) {
    return 'probe';
  }
  if (/指令[:：]\s*状态|当前任务|^\s*状态/i.test(t)) {
    return 'status';
  }
  if (/编码|写代码|^code\b/i.test(t)) {
    return 'code';
  }
  return null;
};

/** 飞书侧可直接转发给用户的拒绝文案（409 体里 `feishuReplyText`）。 */
export const buildConcurrentTaskFeishuReply = (
  existing: ITaskRecord,
  requestedActionLabel: string
): string => {
  const runningLabel = actionLabelZh(existing.action ?? 'unknown');
  const detail =
    existing.message !== undefined && existing.message !== ''
      ? existing.message
      : '（无附加说明）';
  return [
    `当前已有进行中的【${runningLabel}】任务，暂无法重复发起【${requestedActionLabel}】。`,
    `进行中的任务 ID：${existing.taskId}`,
    `该任务说明：${detail}`,
    `状态：${existing.status}`,
    '请等待当前任务结束或失败后再试。',
  ].join('\n');
};
