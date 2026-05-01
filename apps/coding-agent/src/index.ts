import { resolveMonorepoRootFromEntry } from '@agents/agents-config';
import { loadMonorepoEnvFromEntry } from '@agents/logger';

loadMonorepoEnvFromEntry(import.meta.url);

import { listenExpressWithGracefulShutdown } from '@agents/http-errors';
import { createApp } from './app.js';
import { getListenPort } from './config/env.js';
import { SERVICE_NAME } from './config/constants.js';

const monorepoRoot = resolveMonorepoRootFromEntry(import.meta.url);
const app = createApp({ monorepoRoot });
const port = getListenPort();

listenExpressWithGracefulShutdown(app, port, '127.0.0.1', () => {
  process.stdout.write(
    `${SERVICE_NAME} listening on http://127.0.0.1:${port}\n`
  );
});
