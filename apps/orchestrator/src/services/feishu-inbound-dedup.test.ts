import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildFeishuDedupKey,
  tryBeginFeishuInboundDedup,
  finishFeishuInboundDedup,
  resetFeishuInboundDedupForTests,
} from './feishu-inbound-dedup.js';
import { extractFeishuInboundText } from './extract-feishu-inbound.js';

describe('feishu-inbound-dedup', () => {
  beforeEach(() => {
    resetFeishuInboundDedupForTests();
  });

  it('buildFeishuDedupKey prefers message_id', () => {
    const body = {
      header: { event_id: 'evt_dup' },
      event: {
        message: {
          chat_id: 'oc_x',
          message_id: 'om_y',
          content: JSON.stringify({ text: '需求分析：hi' }),
        },
      },
    };
    const ext = extractFeishuInboundText(body);
    expect(ext).not.toBeNull();
    expect(buildFeishuDedupKey(body as Record<string, unknown>, ext!)).toBe(
      'msg:om_y'
    );
  });

  it('buildFeishuDedupKey falls back to header.event_id', () => {
    const body = {
      header: { event_id: 'uuid-feishu-event' },
      event: {
        message: {
          chat_id: 'oc_x',
          content: JSON.stringify({ text: '你好' }),
        },
      },
    };
    const ext = extractFeishuInboundText(body);
    expect(ext).not.toBeNull();
    expect(buildFeishuDedupKey(body as Record<string, unknown>, ext!)).toBe(
      'evt:uuid-feishu-event'
    );
  });

  it('tryBegin rejects duplicate while inflight or done', () => {
    const key = 'msg:test-1';
    expect(tryBeginFeishuInboundDedup(key)).toBe(true);
    expect(tryBeginFeishuInboundDedup(key)).toBe(false);
    finishFeishuInboundDedup(key, true);
    expect(tryBeginFeishuInboundDedup(key)).toBe(false);
  });

  it('finish false clears key so retry can proceed', () => {
    const key = 'msg:test-2';
    expect(tryBeginFeishuInboundDedup(key)).toBe(true);
    finishFeishuInboundDedup(key, false);
    expect(tryBeginFeishuInboundDedup(key)).toBe(true);
  });
});
