import type { Express, Request, Response } from 'express';
import type { ILogger } from '@agents/logger';
import { subscribeFeishuConsole } from '../services/feishu-console-broadcast.js';

const HEARTBEAT_MS = 25_000;

/**
 * 供 Agent Console「运行日志流」订阅：推送与 `teeFeishuFlow` 同源的一行摘要。
 * 仅建议在可信网络 / 本机使用；编排器默认监听本机或内网。
 */
export const registerFeishuConsoleSseRoute = (
  app: Express,
  ctx: { logger: ILogger }
): void => {
  const { logger } = ctx;

  app.get('/v1/console/feishu-log-stream', (req: Request, res: Response) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const send = (chunk: string): void => {
      res.write(chunk);
    };

    send(': connected\n\n');

    const unsubscribe = subscribeFeishuConsole((p) => {
      try {
        send(`data: ${JSON.stringify(p)}\n\n`);
      } catch (e) {
        logger.warn('feishu_console_sse_write_failed', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    });

    const hb = setInterval(() => {
      try {
        send(': ping\n\n');
      } catch {
        clearInterval(hb);
      }
    }, HEARTBEAT_MS);

    const teardown = (): void => {
      clearInterval(hb);
      unsubscribe();
    };

    req.on('close', () => {
      teardown();
      if (!res.writableEnded) {
        res.end();
      }
    });
  });
};
