import type { IAgentsConfig } from './schema.js';

export const resolveFullTestCommand = (
  cfg: IAgentsConfig,
  env: NodeJS.ProcessEnv = process.env,
  taskOverride?: string
): string => {
  const fromTask = taskOverride?.trim();
  if (fromTask !== undefined && fromTask !== '') {
    return fromTask;
  }
  const fromEnv = env.PIPELINE_FULL_TEST_COMMAND?.trim();
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }
  return cfg.pipeline.fullTestCommand;
};
