/** 机器人发出「需求分析」PRD 后登记 message_id ↔ taskId；用户引用回复时用来隐式修订。 */

const anchors = new Map<string, string>();

const maxAnchors = 800;

/** 任一 message_id → 最近一次对应的需求分析任务 */
export const registerFeishuPrdOutboundAnchor = (
  feishuMessageId: string,
  taskId: string
): void => {
  if (feishuMessageId.trim() === '' || taskId.trim() === '') {
    return;
  }
  if (anchors.size >= maxAnchors) {
    const firstKey = anchors.keys().next().value;
    if (firstKey !== undefined) {
      anchors.delete(firstKey);
    }
  }
  anchors.set(feishuMessageId, taskId);
};

export const clearFeishuPrdAnchors = (): void => {
  anchors.clear();
};

export const resolveTaskIdFromQuotedFeishuMessage = (deps: {
  readonly parentMessageId?: string | undefined;
  readonly rootMessageId?: string | undefined;
}): string | undefined => {
  const tryOne = (id: string | undefined): string | undefined => {
    if (id === undefined || id.trim() === '') {
      return undefined;
    }
    return anchors.get(id);
  };
  const byParent = tryOne(deps.parentMessageId);
  if (byParent !== undefined) {
    return byParent;
  }
  return tryOne(deps.rootMessageId);
};
