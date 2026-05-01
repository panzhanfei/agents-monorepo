import type { ILogger } from '@agents/logger';

const kSecondMs = 1000;

type ITokenCache = { token: string; expiresAtMs: number };

let tokenCache: ITokenCache | null = null;

/**
 * OpenAPI 根路径（勿以 `/` 结尾）。
 * 国内默认 `https://open.feishu.cn/open-apis`；飞书国际版 / Lark 多为 `https://open.larksuite.com/open-apis`。
 */
export const getFeishuOpenApiBase = (): string => {
  const raw = process.env.FEISHU_OPEN_API_BASE?.trim() ?? '';
  if (raw === '') {
    return 'https://open.feishu.cn/open-apis';
  }
  return raw.replace(/\/$/, '');
};

/** 测试用：清空 tenant token 内存缓存 */
export const resetFeishuTokenCacheForTests = (): void => {
  tokenCache = null;
};

export const feishuAutoReplyConfigured = (): boolean => {
  const id = process.env.FEISHU_APP_ID;
  const secret = process.env.FEISHU_APP_SECRET;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof secret === 'string' &&
    secret.length > 0
  );
};

const isAutoReplyDisabled = (): boolean => {
  const v = process.env.FEISHU_AUTO_REPLY;
  return v === '0' || v === 'false';
};

export type IFeishuSendResult =
  | { kind: 'skipped' }
  | { kind: 'ok'; messageId?: string }
  | { kind: 'error'; message: string };

const kTokenFetchMs = 12_000;
const kImFetchMs = 15_000;

const parseImJson = (
  raw: string
): { code: number; msg?: string; data?: Record<string, unknown> } | null => {
  try {
    return JSON.parse(raw) as {
      code: number;
      msg?: string;
      data?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
};

const getTenantAccessToken = async (
  appId: string,
  appSecret: string,
  logger: ILogger
): Promise<string | null> => {
  const now = Date.now();
  if (tokenCache !== null && now < tokenCache.expiresAtMs - 120_000) {
    return tokenCache.token;
  }
  const base = getFeishuOpenApiBase();
  const url = `${base}/auth/v3/tenant_access_token/internal`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(kTokenFetchMs),
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });
  const raw = await res.text();
  const parsed = parseImJson(raw);
  if (parsed === null) {
    logger.warn('feishu_token_json_invalid', {
      httpStatus: res.status,
      rawPreview: raw.slice(0, 200),
    });
    return null;
  }
  if (parsed.code !== 0) {
    logger.warn('feishu_token_api_rejected', {
      code: parsed.code,
      msg: parsed.msg,
    });
    return null;
  }
  const extended = parsed as {
    tenant_access_token?: string;
    expire?: number;
    data?: { tenant_access_token?: string };
  };
  const token =
    typeof extended.tenant_access_token === 'string' &&
    extended.tenant_access_token.length > 0
      ? extended.tenant_access_token
      : typeof extended.data?.tenant_access_token === 'string'
        ? extended.data.tenant_access_token
        : undefined;
  if (token === undefined) {
    return null;
  }
  const expireSec =
    typeof extended.expire === 'number' && Number.isFinite(extended.expire)
      ? extended.expire
      : 7200;
  tokenCache = { token, expiresAtMs: now + expireSec * kSecondMs };
  return token;
};

const postImMessageCreate = async (
  token: string,
  chatId: string,
  text: string
): Promise<IFeishuSendResult> => {
  const base = getFeishuOpenApiBase();
  const url = `${base}/im/v1/messages?receive_id_type=chat_id`;
  const content = JSON.stringify({ text });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(kImFetchMs),
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content,
    }),
  });
  const raw = await res.text();
  const obj = parseImJson(raw);
  if (obj === null) {
    return {
      kind: 'error',
      message: `im_response_not_json http=${String(res.status)} ${raw.slice(0, 200)}`,
    };
  }
  if (obj.code !== 0) {
    return {
      kind: 'error',
      message: `im_api code=${String(obj.code)} msg=${String(obj.msg ?? '')}${troubleshootingSuffix(obj.code)}`,
    };
  }
  const messageId =
    obj.data !== undefined && typeof obj.data.message_id === 'string'
      ? obj.data.message_id
      : undefined;
  return { kind: 'ok', messageId };
};

const postImMessageReply = async (
  token: string,
  inboundMessageId: string,
  text: string
): Promise<IFeishuSendResult> => {
  const base = getFeishuOpenApiBase();
  const url = `${base}/im/v1/messages/${encodeURIComponent(inboundMessageId)}/reply`;
  const content = JSON.stringify({ text });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(kImFetchMs),
    body: JSON.stringify({
      msg_type: 'text',
      content,
    }),
  });
  const raw = await res.text();
  const obj = parseImJson(raw);
  if (obj === null) {
    return {
      kind: 'error',
      message: `im_reply_not_json http=${String(res.status)} ${raw.slice(0, 200)}`,
    };
  }
  if (obj.code !== 0) {
    return {
      kind: 'error',
      message: `im_reply_api code=${String(obj.code)} msg=${String(obj.msg ?? '')}${troubleshootingSuffix(obj.code)}`,
    };
  }
  const messageId =
    obj.data !== undefined && typeof obj.data.message_id === 'string'
      ? obj.data.message_id
      : undefined;
  return { kind: 'ok', messageId };
};

const troubleshootingSuffix = (code: number): string => {
  if (code === 99_991_673) {
    return ' (提示: 多为应用未安装到租户/可用范围不含会话/权限未发布生效，或 FEISHU_OPEN_API_BASE 与国际版域名不一致；非 token 刷新问题)';
  }
  return '';
};

/**
 * 优先对「用户这条消息」reply，失败再按 chat_id 直发（与 release-bot 一致，部分租户下 reply 路径更可用）。
 */
export const sendFeishuOutboundText = async (deps: {
  chatId?: string;
  inboundMessageId?: string;
  text: string;
  logger: ILogger;
}): Promise<IFeishuSendResult> => {
  try {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      return { kind: 'skipped' };
    }
    if (isAutoReplyDisabled()) {
      return { kind: 'skipped' };
    }

    const text =
      deps.text.length > 18_000
        ? `${deps.text.slice(0, 18_000)}\n\n…（内容过长，已截断）`
        : deps.text;

    const token = await getTenantAccessToken(appId, appSecret, deps.logger);
    if (token === null) {
      return { kind: 'error', message: 'tenant_access_token_unavailable' };
    }

    let replyErr = '';
    if (
      deps.inboundMessageId !== undefined &&
      deps.inboundMessageId.length > 0
    ) {
      const replyResult = await postImMessageReply(
        token,
        deps.inboundMessageId,
        text
      );
      if (replyResult.kind === 'ok') {
        deps.logger.info('feishu_im_message_sent', {
          mode: 'reply',
          inboundSuffix: deps.inboundMessageId.slice(-8),
          messageId: replyResult.messageId ?? null,
        });
        return replyResult;
      }
      replyErr =
        replyResult.kind === 'error' ? replyResult.message : 'reply_unknown';
      deps.logger.warn('feishu_im_reply_failed_fallback', {
        message: replyErr,
      });
    }

    if (deps.chatId !== undefined && deps.chatId.length > 0) {
      const sendResult = await postImMessageCreate(token, deps.chatId, text);
      if (sendResult.kind === 'ok') {
        deps.logger.info('feishu_im_message_sent', {
          mode: 'chat_id',
          chatIdSuffix: deps.chatId.slice(-8),
          messageId: sendResult.messageId ?? null,
        });
        return sendResult;
      }
      const chatErr =
        sendResult.kind === 'error' ? sendResult.message : 'chat_unknown';
      throw new Error(
        replyErr !== ''
          ? `reply:${replyErr}; chat_id:${chatErr}`
          : chatErr
      );
    }

    return {
      kind: 'error',
      message:
        replyErr !== ''
          ? `reply_failed_no_chat_id:${replyErr}`
          : 'missing_chat_id_and_inbound_message_id',
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    deps.logger.warn('feishu_im_request_failed', { message });
    return { kind: 'error', message: `network:${message}` };
  }
};

/** 仅按群 chat_id 发送（测试/简单调用） */
export const sendFeishuTextToChat = async (deps: {
  chatId: string;
  text: string;
  logger: ILogger;
}): Promise<IFeishuSendResult> =>
  sendFeishuOutboundText({
    chatId: deps.chatId,
    text: deps.text,
    logger: deps.logger,
  });
