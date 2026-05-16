import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAgentsConfig,
  createInMemorySetupTokenStore,
  createNodeAgentSlotsGateway,
  createOpenAiEntryChatLlmGateway,
  loadProcessEnv,
} from "@/infrastructure";
import { createHttpApplication, type IAppRuntime } from "@/interfaces";

loadProcessEnv();

const openUrlInBrowser = (url: string): void => {
  const platform = process.platform;
  if (platform === "darwin") {
    execFile("open", [url], () => {});
  } else if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, () => {});
  } else {
    execFile("xdg-open", [url], () => {});
  }
};

const bindSetupUrl = (webOrigin: string, token: string, listenPort: number): string => {
  const origin = webOrigin.replace(/\/$/, "");
  const ingestUrl = `http://127.0.0.1:${listenPort}/v1/setup/ingest`;
  const qs = new URLSearchParams({ ingestUrl, setupToken: token });
  return `${origin}/settings/local-init?${qs.toString()}`;
};

const bootstrap = (): void => {
  const config = buildAgentsConfig();
  const hasCreds = Boolean(config.deviceKey && config.deviceSecret);
  const setupToken = createInMemorySetupTokenStore();

  if (!hasCreds) {
    setupToken.setPending(setupToken.newToken());
  }

  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const localDotenvPath = path.join(pkgRoot, ".env");

  const runtime: IAppRuntime = {
    config,
    agentSlots: createNodeAgentSlotsGateway(config.nodeApiBase, config.deviceKey, config.deviceSecret),
    llm: createOpenAiEntryChatLlmGateway(),
    setupToken,
    localDotenvPath,
  };

  const app = createHttpApplication(runtime);

  const server = app.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.info(`agents listening on http://${config.host}:${config.port}`);

    if (!hasCreds) {
      const token = setupToken.getPending();
      if (token) {
        const url = bindSetupUrl(config.setupWebOrigin, token, config.port);
        // eslint-disable-next-line no-console
        console.warn("\n首次启动：正在打开浏览器完成本机环境准备（或手动访问）：\n", url, "\n");
        if (config.setupOpenBrowser) {
          openUrlInBrowser(url);
        }
      }
    }
  });

  const shutdown = (): void => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

bootstrap();
