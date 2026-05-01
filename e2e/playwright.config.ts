import { defineConfig, devices } from '@playwright/test';

const startLocalServer = process.env.E2E_SKIP_WEB_SERVER !== '1';

const orchestratorOrigin =
  process.env.E2E_ORCHESTRATOR_URL ?? 'http://127.0.0.1:4010';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: orchestratorOrigin.replace(/\/$/, ''),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startLocalServer
    ? [
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/orchestrator',
          env: { ...process.env, PORT: '4010' },
          url: 'http://127.0.0.1:4010/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/coding-agent',
          env: { ...process.env, PORT: '4020' },
          url: 'http://127.0.0.1:4020/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/review-agent',
          env: { ...process.env, PORT: '4030' },
          url: 'http://127.0.0.1:4030/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/test-agent',
          env: { ...process.env, PORT: '4041' },
          url: 'http://127.0.0.1:4041/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/ops-agent',
          env: { ...process.env, PORT: '4050' },
          url: 'http://127.0.0.1:4050/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'pnpm exec tsx src/index.ts',
          cwd: '../apps/requirements-agent',
          env: { ...process.env, PORT: '4060' },
          url: 'http://127.0.0.1:4060/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ]
    : undefined,
});
