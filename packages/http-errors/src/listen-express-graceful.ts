import type { Express } from 'express';
import { createServer, type Server } from 'node:http';

const GRACEFUL_EXIT_MS = 10_000;
/** `tsx watch` 重启 + OS 释放端口存在竞态，短暂重试可吞掉绝大多数 EADDRINUSE */
const LISTEN_RETRY_MAX = 25;
const LISTEN_RETRY_BASE_MS = 45;

/**
 * `tsx watch` 在依赖包重编译时会发 SIGTERM 重启进程；若不 `server.close()`，监听端口短时间不释放，易触发 EADDRINUSE。
 * 对仍偶发的占用，在退出前按指数回退做有限次重试。
 */
export const listenExpressWithGracefulShutdown = (
  app: Express,
  port: number,
  hostname: string,
  onListening: () => void
): Server => {
  const server = createServer(app);
  let attempt = 0;

  const shutdown = (): void => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, GRACEFUL_EXIT_MS).unref();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const tryListen = (): void => {
    attempt += 1;
    server.removeAllListeners('error');
    server.listen(port, hostname, () => {
      onListening();
    });
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < LISTEN_RETRY_MAX) {
        server.close(() => {
          const backoff = LISTEN_RETRY_BASE_MS * Math.min(attempt, 14);
          setTimeout(tryListen, backoff).unref();
        });
        return;
      }
      process.stderr.write(
        `[listen] ${hostname}:${port} — ${err.message} (after ${String(attempt)} attempt(s))\n`
      );
      process.exit(1);
    });
  };

  tryListen();
  return server;
};
