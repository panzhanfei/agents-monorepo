import type { Server as HttpServer } from "node:http";

import {
  type IRunnerAgentSlotsResult,
  getRunnerAgentSlots,
  loadAgentsSettings,
  loadEnv,
  postRunnerHeartbeat,
  RunnerGatewayError,
  tryResolveRunnerCredentials,
} from "@/infrastructure";
import { createHttpApp } from "@/interfaces";

const logAgentSlotsWarmup = (outcome: IRunnerAgentSlotsResult): void => {
  if (outcome.status === 304) {
    // eslint-disable-next-line no-console -- process bootstrap logging
    console.info("[agents] agent-slots unchanged (304)");
    return;
  }
  const keys = Object.keys(outcome.payload.slots).sort().join(",");
  // eslint-disable-next-line no-console -- process bootstrap logging
  console.info(
    `[agents] agent-slots ok revision=${outcome.payload.configRevision} (${keys})`,
  );
};

const logRunnerWarmupFailure = (err: unknown): void => {
  let msg: string;
  if (err instanceof RunnerGatewayError) {
    msg = err.bodySnippet ? `${err.message} …${err.bodySnippet}` : err.message;
  } else if (err instanceof Error) {
    msg = err.message;
  } else {
    msg = String(err);
  }
  // eslint-disable-next-line no-console -- process bootstrap logging
  console.warn(`[agents] runner control-plane warmup failed: ${msg}`);
};

loadEnv();

const settings = loadAgentsSettings();
const app = createHttpApp(settings);

const warmupRunnerControlPlane = (): void => {
  const creds = tryResolveRunnerCredentials();
  if (!creds) {
    // eslint-disable-next-line no-console -- process bootstrap logging
    console.info(
      "[agents] runner credentials incomplete (RUNNER_NODE_API_BASE / RUNNER_DEVICE_KEY / RUNNER_DEVICE_SECRET); skip warmup",
    );
    return;
  }

  postRunnerHeartbeat(creds)
    .then((hb) => {
      // eslint-disable-next-line no-console -- process bootstrap logging
      console.info(`[agents] runner heartbeat ok (lastSeenAt=${hb.lastSeenAt})`);
      return getRunnerAgentSlots(creds);
    })
    .then(logAgentSlotsWarmup)
    .catch(logRunnerWarmupFailure);
};

const server: HttpServer = app.listen(settings.port, settings.host, () => {
  // eslint-disable-next-line no-console -- process bootstrap logging
  console.info(
    `[agents] listening on http://${settings.host}:${settings.port} (${settings.nodeEnv})`,
  );
  warmupRunnerControlPlane();
});

const shutdownHttp = (signal: string, srv: HttpServer): void => {
  // eslint-disable-next-line no-console -- process lifecycle logging
  console.info(`[agents] ${signal} received; closing HTTP server`);
  srv.close(() => {
    process.exit(0);
  });
};

process.once("SIGINT", () => shutdownHttp("SIGINT", server));
process.once("SIGTERM", () => shutdownHttp("SIGTERM", server));
