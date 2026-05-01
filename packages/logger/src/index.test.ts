import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './index.js';

describe('@agents/logger', () => {
  it('createLogger writes json lines to stdout', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AGENTS_LOG_DIR', '');
    const logger = createLogger({ service: 'test' });
    logger.info('hello', { taskId: 't1' });
    expect(stdout.mock.calls.length).toBe(1);
    const line = String(stdout.mock.calls[0][0]);
    const row = JSON.parse(line) as { level: string; msg: string; taskId?: string };
    expect(row.level).toBe('info');
    expect(row.msg).toBe('hello');
    expect(row.taskId).toBe('t1');
    stdout.mockRestore();
    vi.unstubAllEnvs();
  });

  it('createLogger writes error lines to stderr', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AGENTS_LOG_DIR', '');
    const logger = createLogger({ service: 'test' });
    logger.error('oops', { code: 'E1' });
    expect(stderr.mock.calls.length).toBe(1);
    const row = JSON.parse(String(stderr.mock.calls[0][0])) as {
      level: string;
      msg: string;
      code?: string;
    };
    expect(row.level).toBe('error');
    expect(row.msg).toBe('oops');
    expect(row.code).toBe('E1');
    stderr.mockRestore();
    vi.unstubAllEnvs();
  });

  it('appends to AGENTS_LOG_DIR when set (absolute path)', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.stubEnv('NODE_ENV', 'test');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-log-'));
    vi.stubEnv('AGENTS_LOG_DIR', dir);
    const logger = createLogger({ service: 'unit' });
    logger.info('hello', { taskId: 't1' });
    const file = path.join(dir, 'unit.log');
    expect(fs.existsSync(file)).toBe(true);
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    const rows = lines.map((l) => JSON.parse(l) as { msg: string; taskId?: string });
    expect(rows.some((r) => r.msg === 'logger_ready')).toBe(true);
    expect(rows.some((r) => r.msg === 'hello' && r.taskId === 't1')).toBe(true);
    stdout.mockRestore();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true });
  });
});
