import { describe, expect, it } from 'vitest';
import {
  clearFeishuPrdAnchors,
  registerFeishuPrdOutboundAnchor,
  resolveTaskIdFromQuotedFeishuMessage,
} from './feishu-prd-thread-anchor.js';

describe('feishu-prd-thread-anchor', () => {
  it('resolves by parent then root', () => {
    clearFeishuPrdAnchors();
    registerFeishuPrdOutboundAnchor('mid_a', 'tid1');
    registerFeishuPrdOutboundAnchor('mid_root', 'tid2');
    expect(
      resolveTaskIdFromQuotedFeishuMessage({
        parentMessageId: 'mid_a',
        rootMessageId: 'mid_root',
      })
    ).toBe('tid1');
    expect(
      resolveTaskIdFromQuotedFeishuMessage({
        parentMessageId: 'unknown',
        rootMessageId: 'mid_root',
      })
    ).toBe('tid2');
    clearFeishuPrdAnchors();
  });
});
