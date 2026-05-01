import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { agentsConfigSchema, type IAgentsConfig } from './schema.js';

export type ILoadAgentsConfigOptions = {
  readonly monorepoRoot: string;
};

export const resolveAgentsConfigPath = (
  monorepoRoot: string,
  env: NodeJS.ProcessEnv = process.env
): string => {
  const raw = env.AGENTS_CONFIG_PATH?.trim();
  if (raw !== undefined && raw !== '') {
    return path.isAbsolute(raw) ? raw : path.resolve(monorepoRoot, raw);
  }
  return path.join(monorepoRoot, 'agents.config.yaml');
};

export const loadAgentsConfig = async (
  opts: ILoadAgentsConfigOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<IAgentsConfig> => {
  const configPath = resolveAgentsConfigPath(opts.monorepoRoot, env);
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (e) {
    throw new Error(
      `无法读取编排配置：${configPath}（${e instanceof Error ? e.message : String(e)}）`
    );
  }
  const parsed: unknown = YAML.parse(raw);
  const result = agentsConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`agents.config.yaml 结构校验失败：${result.error.message}`);
  }
  return result.data;
};

export type { IAgentsConfig };
