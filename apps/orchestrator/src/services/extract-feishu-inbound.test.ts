import { describe, expect, it } from 'vitest';
import { extractFeishuInboundText } from './extract-feishu-inbound.js';

describe('extractFeishuInboundText', () => {
  it('reads flat dev body', () => {
    expect(extractFeishuInboundText({ text: '  你好  ', channelId: 'c1' })).toEqual(
      { text: '你好', channelId: 'c1' }
    );
  });

  it('reads Feishu event.message.content JSON', () => {
    const body = {
      event: {
        message: {
          chat_id: 'oc_xxx',
          message_id: 'om_yyy',
          content: JSON.stringify({ text: '需求分析：做一个工单列表' }),
        },
      },
    };
    expect(extractFeishuInboundText(body)).toEqual({
      text: '需求分析：做一个工单列表',
      channelId: 'oc_xxx',
      inboundMessageId: 'om_yyy',
    });
  });

  it('strips @mention prefix from flat body', () => {
    expect(extractFeishuInboundText({ text: '@流水线 你好', channelId: 'c1' })).toEqual(
      { text: '你好', channelId: 'c1' }
    );
  });

  it('returns null for encrypt-only stub', () => {
    expect(extractFeishuInboundText({ encrypt: 'abc' })).toBeNull();
  });
});
