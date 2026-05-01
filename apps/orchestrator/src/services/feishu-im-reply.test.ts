import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  feishuAutoReplyConfigured,
  resetFeishuTokenCacheForTests,
  sendFeishuTextToChat,
} from './feishu-im-reply.js';
import { createLogger } from '@agents/logger';

const logger = createLogger({ service: 'orchestrator-test' });

describe('sendFeishuTextToChat', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    resetFeishuTokenCacheForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: 9999, msg: 'unexpected' }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...origEnv };
    resetFeishuTokenCacheForTests();
  });

  it('skips when app credentials missing', async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    const r = await sendFeishuTextToChat({
      chatId: 'oc_x',
      text: 'hi',
      logger,
    });
    expect(r.kind).toBe('skipped');
    expect(feishuAutoReplyConfigured()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips when FEISHU_AUTO_REPLY=0', async () => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'sec';
    process.env.FEISHU_AUTO_REPLY = '0';
    const r = await sendFeishuTextToChat({
      chatId: 'oc_x',
      text: 'hi',
      logger,
    });
    expect(r.kind).toBe('skipped');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches token then sends im message', async () => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'sec';
    delete process.env.FEISHU_AUTO_REPLY;

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('tenant_access_token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              code: 0,
              tenant_access_token: 't-abc',
              expire: 7200,
            }),
        };
      }
      if (u.includes('/im/v1/messages')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              code: 0,
              data: { message_id: 'om_mid' },
            }),
        };
      }
      return {
        ok: false,
        status: 500,
        text: async () => '{}',
      };
    });

    const r = await sendFeishuTextToChat({
      chatId: 'oc_chat1',
      text: 'hello',
      logger,
    });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.messageId).toBe('om_mid');
    }
    expect(fetchMock.mock.calls.length).toBe(2);
    const imCall = fetchMock.mock.calls[1];
    expect(String(imCall[0])).toContain('receive_id_type=chat_id');
    const init = imCall[1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.receive_id).toBe('oc_chat1');
    expect(body.msg_type).toBe('text');
    expect(JSON.parse(String(body.content))).toEqual({ text: 'hello' });
  });
});
