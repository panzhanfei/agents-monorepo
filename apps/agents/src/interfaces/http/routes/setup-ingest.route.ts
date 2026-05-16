import type express from "express";
import { z } from "zod";
import { ingestDeviceCredentials } from "@/application";
import type { IAppRuntime } from "../runtime";

const setupIngestBody = z.object({
  deviceKey: z.string().min(1),
  deviceSecret: z.string().min(1),
  nodeApiBase: z.string().min(1),
});

export const mountSetupIngestRoute = (app: express.Express, runtime: IAppRuntime): void => {
  app.post("/v1/setup/ingest", (req, res) => {
    const headerRaw = req.headers["x-runner-setup-token"];
    const headerTok = typeof headerRaw === "string" ? headerRaw : "";
    const parsed = setupIngestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "invalid body" });
      return;
    }

    const result = ingestDeviceCredentials(
      {
        deviceKey: parsed.data.deviceKey,
        deviceSecret: parsed.data.deviceSecret,
        nodeApiBase: parsed.data.nodeApiBase,
        setupTokenHeader: headerTok,
      },
      {
        config: runtime.config,
        setupToken: runtime.setupToken,
        slotsGateway: runtime.agentSlots,
        localDotenvPath: runtime.localDotenvPath,
      },
    );

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    // eslint-disable-next-line no-console -- setup feedback
    console.info(`device credentials written to ${runtime.config.deviceEnvPath}`);
    if (runtime.config.syncCredentialsToLocalDotenv) {
      // eslint-disable-next-line no-console
      console.info(`RUNNER_* mirrored to ${runtime.localDotenvPath}`);
    }
    res.json({ ok: true });
  });
};
