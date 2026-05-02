import type { IAgentsConfig } from './schema.js';

export type IResolvedReviewExecutionConfig = {
  readonly profileName: string;
  readonly aiRulesGlob: string;
  readonly customerRulesDir: string;
  readonly blockingCommands: readonly string[];
  readonly extraConfigFiles: readonly string[];
};

export const resolveReviewExecutionConfig = (
  cfg: IAgentsConfig,
  env: NodeJS.ProcessEnv = process.env
): IResolvedReviewExecutionConfig => {
  const profileEnv = env.REVIEW_RULES_PROFILE?.trim();
  const profileName =
    profileEnv !== undefined && profileEnv !== ''
      ? profileEnv
      : cfg.review.activeProfile;
  const profile = cfg.review.profiles[profileName];
  if (profile === undefined) {
    throw new Error(`未知的审核 profile：${profileName}`);
  }

  const blockingFromEnv = env.REVIEW_BLOCKING_COMMAND?.trim();
  const blockingCommands =
    blockingFromEnv !== undefined && blockingFromEnv !== ''
      ? [blockingFromEnv]
      : [...profile.blockingCommands];

  const aiRulesGlob = profile.aiRulesGlob;

  const custEnv = env.REVIEW_CUSTOM_RULES_DIR?.trim();
  const customerRulesDir =
    custEnv !== undefined && custEnv !== ''
      ? custEnv
      : profile.customerRulesDir;

  const yamlExtras = cfg.review.extraConfigFiles ?? [];
  const envExtras =
    env.REVIEW_CONFIG_FILES?.split(',').flatMap((s) => {
      const x = s.trim();
      return x === '' ? [] : [x];
    }) ?? [];
  const extraConfigFiles = [...new Set([...yamlExtras, ...envExtras])];

  return {
    profileName,
    aiRulesGlob,
    customerRulesDir,
    blockingCommands,
    extraConfigFiles,
  };
};
