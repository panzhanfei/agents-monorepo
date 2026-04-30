import { describe, expect, it } from 'vitest';
import {
  parseIntentFromMessage,
  buildConcurrentTaskFeishuReply,
} from './intent-concurrency.js';

describe('intent-concurrency', () => {
  it('parseIntentFromMessage detects code', () => {
    expect(parseIntentFromMessage('编码：修 login')).toBe('code');
  });

  it('parseIntentFromMessage detects requirements', () => {
    expect(parseIntentFromMessage('指令：需求分析\n说明…')).toBe(
      'requirements_analysis'
    );
  });

  it('buildConcurrentTaskFeishuReply includes task id and message', () => {
    const text = buildConcurrentTaskFeishuReply(
      {
        taskId: 'tid-1',
        status: 'running',
        action: 'code',
        message: '实现登录',
        metadata: undefined,
        createdAt: '',
        updatedAt: '',
      },
      '编码'
    );
    expect(text).toContain('tid-1');
    expect(text).toContain('实现登录');
    expect(text).toContain('编码');
  });
});
