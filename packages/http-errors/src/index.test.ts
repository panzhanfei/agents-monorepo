import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AppError, createExpressErrorHandler } from './index.js';
import { createLogger } from '@agents/logger';

describe('@agents/http-errors', () => {
  it('maps AppError to JSON body', () => {
    const logger = createLogger({ service: 'test' });
    const errSpy = vi.spyOn(logger, 'error');
    const handler = createExpressErrorHandler({ logger });
    const req = { path: '/x' } as Request;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = vi.fn();
    handler(new AppError('X', 'bad', 418), req, res, next);
    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'X', message: 'bad' },
    });
    expect(errSpy).not.toHaveBeenCalled();
  });
});
