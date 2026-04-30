import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './index.js';

describe('@agents/logger', () => {
  it('createLogger writes json lines', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = createLogger({ service: 'test' });
    logger.info('hello', { taskId: 't1' });
    expect(stdout.mock.calls.length).toBe(1);
    const line = String(stdout.mock.calls[0][0]);
    const row = JSON.parse(line) as { level: string; msg: string; taskId?: string };
    expect(row.level).toBe('info');
    expect(row.msg).toBe('hello');
    expect(row.taskId).toBe('t1');
    stdout.mockRestore();
  });
});
