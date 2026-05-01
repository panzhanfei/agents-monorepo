const channelBoundTargetIds = new Map<string, string>();

export const channelKeyForFeishu = (
  channelId: string | undefined
): string =>
  channelId !== undefined && channelId !== ''
    ? channelId
    : '_no_feishu_channel';

export const setFeishuChannelBoundTargetId = (
  channelId: string | undefined,
  targetProjectId: string
): void => {
  channelBoundTargetIds.set(
    channelKeyForFeishu(channelId),
    targetProjectId.trim()
  );
};

export const getFeishuChannelBoundTargetId = (
  channelId: string | undefined
): string | undefined =>
  channelBoundTargetIds.get(channelKeyForFeishu(channelId));
