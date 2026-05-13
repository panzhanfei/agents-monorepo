import { createServer } from "http";
import { getEnv } from "@/config";
import { createApp, gracefulShutdown } from "@/server.js";
import { logger } from "@/middleware";

const env = getEnv();
const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info({ msg: "http_listen", port: env.PORT });
});

const onSignal = (signal: NodeJS.Signals): void => {
  void gracefulShutdown({ server, timeoutMs: env.HTTP_SHUTDOWN_TIMEOUT_MS }, signal).finally(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));
