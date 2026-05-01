import { normalizeFeishuPlainText } from './normalize-feishu-text.js';

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

export type IFeishuInboundExtract = {
  text: string;
  channelId?: string;
  /** 用户触发这条 webhook 的飞书消息 id；用于 `im/v1/messages/:id/reply`，优先于往群直发 */
  inboundMessageId?: string;
  /** 用户「回复 / 话题」所挂的父消息 id；引用机器人 PRD 时多为该条机器人 message_id */
  parentMessageId?: string;
  /** 话题根消息 id（部分事件下与 parent 二选一可解析到引用链） */
  rootMessageId?: string;
};

/**
 * 从飞书事件体或本地调试扁平 body 中取出用户可见正文与可选会话 id。
 * 飞书文本消息：`event.message.content` 为 JSON 字符串，内层 `text` 为正文。
 */
export const extractFeishuInboundText = (
  body: unknown
): IFeishuInboundExtract | null => {
  const root = asRecord(body);
  if (root === null) {
    return null;
  }

  const flatTextRaw =
    typeof root.text === 'string'
      ? root.text
      : typeof root.message === 'string'
        ? root.message
        : '';
  const flatChannelId =
    typeof root.channelId === 'string' && root.channelId !== ''
      ? root.channelId
      : undefined;
  const flatInboundMessageId =
    typeof root.inboundMessageId === 'string' && root.inboundMessageId !== ''
      ? root.inboundMessageId
      : typeof root.messageId === 'string' && root.messageId !== ''
        ? root.messageId
        : undefined;

  if (flatTextRaw.trim() !== '') {
    const normalized = normalizeFeishuPlainText(flatTextRaw);
    if (normalized === '') {
      return null;
    }
    return {
      text: normalized,
      ...(flatChannelId !== undefined ? { channelId: flatChannelId } : {}),
      ...(flatInboundMessageId !== undefined
        ? { inboundMessageId: flatInboundMessageId }
        : {}),
    };
  }

  const event = asRecord(root.event);
  if (event === null) {
    return null;
  }

  const msg = asRecord(event.message);
  if (msg === null) {
    return null;
  }

  const contentRaw = msg.content;
  if (typeof contentRaw !== 'string' || contentRaw.trim() === '') {
    return null;
  }

  let innerText = '';
  const parsed = ((): unknown => {
    try {
      return JSON.parse(contentRaw) as unknown;
    } catch {
      return null;
    }
  })();
  const contentObj = asRecord(parsed);
  if (contentObj !== null && typeof contentObj.text === 'string') {
    innerText = contentObj.text;
  } else {
    innerText = contentRaw;
  }

  innerText = normalizeFeishuPlainText(innerText);
  if (innerText === '') {
    return null;
  }

  const chatId =
    typeof msg.chat_id === 'string' && msg.chat_id !== ''
      ? msg.chat_id
      : typeof event.chat_id === 'string' && event.chat_id !== ''
        ? event.chat_id
        : flatChannelId;

  const inboundMessageId =
    typeof msg.message_id === 'string' && msg.message_id !== ''
      ? msg.message_id
      : undefined;

  const parentMessageId =
    typeof msg.parent_id === 'string' && msg.parent_id !== ''
      ? msg.parent_id
      : undefined;
  const rootMessageId =
    typeof msg.root_id === 'string' && msg.root_id !== ''
      ? msg.root_id
      : undefined;

  return {
    text: innerText,
    ...(chatId !== undefined ? { channelId: chatId } : {}),
    ...(inboundMessageId !== undefined
      ? { inboundMessageId }
      : {}),
    ...(parentMessageId !== undefined ? { parentMessageId } : {}),
    ...(rootMessageId !== undefined ? { rootMessageId } : {}),
  };
};
