import { describe, expect, it } from 'vitest';
import { normalizeFeishuPlainText } from './normalize-feishu-text.js';

describe('normalizeFeishuPlainText', () => {
  it('strips @bot name before greeting', () => {
    expect(normalizeFeishuPlainText('@流水线 你好')).toBe('你好');
  });

  it('strips feishu <at> tag', () => {
    expect(
      normalizeFeishuPlainText('<at user_id="ou_xxx">展飞</at> 需求分析：todo')
    ).toBe('需求分析：todo');
  });
});
