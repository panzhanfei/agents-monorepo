import { afterEach, describe, expect, it } from 'vitest';

import { resolveAgentHttpBaseUrlFromEnv } from './agent-http-base-url.js';

describe('resolveAgentHttpBaseUrlFromEnv', () => {
  afterEach(() => {
    delete process.env.AGENTS_INTERNAL_HTTP_HOST;
  });

  it('returns trimmed explicit BASE_URL when provided', () => {
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '  https://coding.example/agent  ',
        portEnv: '',
        portDefault: 4020,
      }),
    ).toBe('https://coding.example/agent');
  });

  it('derives localhost and defaultPort when BASE empty', () => {
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '',
        portEnv: undefined,
        portDefault: 4020,
      }),
    ).toBe('http://127.0.0.1:4020');
  });

  it('uses port env override', () => {
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '',
        portEnv: '5020',
        portDefault: 4020,
      }),
    ).toBe('http://127.0.0.1:5020');
  });

  it('honors AGENTS_INTERNAL_HTTP_HOST for derived URL', () => {
    process.env.AGENTS_INTERNAL_HTTP_HOST = 'review-svc';
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '',
        portEnv: undefined,
        portDefault: 4030,
      }),
    ).toBe('http://review-svc:4030');
  });

  it('falls back to defaultPort on invalid port string', () => {
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '',
        portEnv: 'not-a-port',
        portDefault: 4041,
      }),
    ).toBe('http://127.0.0.1:4041');
  });

  it('falls back to defaultPort on out-of-range port', () => {
    expect(
      resolveAgentHttpBaseUrlFromEnv({
        explicitBaseUrlEnv: '',
        portEnv: '99999',
        portDefault: 4020,
      }),
    ).toBe('http://127.0.0.1:4020');
  });
});
