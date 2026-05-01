import { describe, expect, it } from 'vitest';
import {
  parseIntentFromMessage,
  buildConcurrentTaskFeishuReply,
} from './intent-concurrency.js';

describe('intent-concurrency', () => {
  it('parseIntentFromMessage detects clear_tasks', () => {
    expect(parseIntentFromMessage('清空任务')).toBe('clear_tasks');
    expect(parseIntentFromMessage('重置任务')).toBe('clear_tasks');
    expect(parseIntentFromMessage('指令：清除任务')).toBe('clear_tasks');
  });

  it('parseIntentFromMessage treats leading 修订 <uuid> as requirements', () => {
    expect(
      parseIntentFromMessage(
        '修订 a1b2c3d4-e5f6-7890-abcd-ef1234567890：补充说明'
      )
    ).toBe('requirements_analysis');
  });

  it('parseIntentFromMessage detects code', () => {
    expect(parseIntentFromMessage('编码：修 login')).toBe('code');
  });

  it('parseIntentFromMessage detects requirements', () => {
    expect(parseIntentFromMessage('指令：需求分析\n说明…')).toBe(
      'requirements_analysis'
    );
  });

  it('parseIntentFromMessage treats greetings as help', () => {
    expect(parseIntentFromMessage('你好')).toBe('help');
    expect(parseIntentFromMessage('Hello！')).toBe('help');
    expect(parseIntentFromMessage('在吗')).toBe('help');
  });

  it('parseIntentFromMessage detects help', () => {
    expect(parseIntentFromMessage('帮助')).toBe('help');
    expect(parseIntentFromMessage('新手指引')).toBe('help');
    expect(parseIntentFromMessage('指令：帮助')).toBe('help');
    expect(parseIntentFromMessage('help')).toBe('help');
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
