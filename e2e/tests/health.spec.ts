import { expect, test } from '@playwright/test';

test.describe('agent services health', () => {
  test('orchestrator GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4010/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('orchestrator');
  });

  test('coding-agent GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4020/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('coding-agent');
  });

  test('review-agent GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4030/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('review-agent');
  });

  test('test-agent GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4040/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('test-agent');
  });

  test('ops-agent GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4050/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('ops-agent');
  });

  test('requirements-agent GET /health', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4060/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.agent).toBe('requirements-agent');
  });
});
