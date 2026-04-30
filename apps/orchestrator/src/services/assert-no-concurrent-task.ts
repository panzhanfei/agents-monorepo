import type {
  IFindActiveTaskQuery,
  ITaskRecord,
  ITaskStore,
} from '@agents/pipeline-core';
import {
  ACTIONS_SKIP_CONCURRENCY_GUARD,
  buildConcurrentTaskFeishuReply,
  actionLabelZh,
} from './intent-concurrency.js';

export type IConcurrentCheckResult =
  | { ok: true }
  | {
      ok: false;
      existingTask: ITaskRecord;
      feishuReplyText: string;
    };

/**
 * 同一 `action`（及可选 `channelId`）仅允许一个进行中任务，供飞书侧原样返回。
 */
export const assertNoConcurrentExclusiveTask = async (
  taskStore: ITaskStore,
  action: string,
  options?: { channelId?: string }
): Promise<IConcurrentCheckResult> => {
  if (ACTIONS_SKIP_CONCURRENCY_GUARD.has(action)) {
    return { ok: true };
  }
  const q: IFindActiveTaskQuery = {
    action,
    channelId: options?.channelId,
  };
  const existing = await taskStore.findActiveTaskByAction(q);
  if (existing === null) {
    return { ok: true };
  }
  const label = actionLabelZh(action);
  return {
    ok: false,
    existingTask: existing,
    feishuReplyText: buildConcurrentTaskFeishuReply(existing, label),
  };
};
