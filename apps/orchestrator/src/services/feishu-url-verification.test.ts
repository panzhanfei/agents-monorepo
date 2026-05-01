import { describe, expect, it } from 'vitest';
import { extractFeishuUrlVerificationChallenge } from './feishu-url-verification.js';

describe('extractFeishuUrlVerificationChallenge', () => {
  it('returns challenge for top-level url_verification', () => {
    expect(
      extractFeishuUrlVerificationChallenge({
        type: 'url_verification',
        token: 't',
        challenge: 'abc123',
      })
    ).toBe('abc123');
  });

  it('returns challenge when nested under event', () => {
    expect(
      extractFeishuUrlVerificationChallenge({
        schema: '2.0',
        event: { type: 'url_verification', challenge: 'nested' },
      })
    ).toBe('nested');
  });

  it('returns null for normal payloads', () => {
    expect(extractFeishuUrlVerificationChallenge({ text: 'help' })).toBeNull();
    expect(extractFeishuUrlVerificationChallenge(null)).toBeNull();
  });
});
