import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { IAgentsConfig, IAgentsConfigParsed } from './schema.js';
import {
  targetProjectDefinitionFileSchema,
  targetProjectEntrySchema,
  type ITargetProjectEntry,
  type ITargetProjectYamlRow,
} from './schema.js';

const OVERLAY_KEYS = [
  'workspacePath',
  'label',
  'gitRepoUrl',
  'defaultBranch',
  'packBuildOutputDir',
  'deployRemotePath',
  'deploySshHost',
  'deploySshUser',
  'deploySshPort',
  'probeListenPorts',
  'publishCommand',
  'fullTestCommand',
  'workspaceLifecycle',
] as const satisfies readonly (keyof ITargetProjectYamlRow)[];

const pickNonEmptyStringOverrides = (
  row: ITargetProjectYamlRow,
): Partial<ITargetProjectEntry> => {
  const out: Partial<ITargetProjectEntry> = {};
  for (const k of OVERLAY_KEYS) {
    const v = row[k];
    if (k === 'workspaceLifecycle') {
      if (v === 'greenfield' || v === 'existing') {
        out.workspaceLifecycle = v;
      }
      continue;
    }
    if (typeof v === 'string' && v.trim() !== '') {
      (out as Record<string, string>)[k] = v.trim();
    }
  }
  return out;
};

const resolveOneTargetProject = async (
  monorepoRoot: string,
  row: ITargetProjectYamlRow,
): Promise<ITargetProjectEntry> => {
  let base: Record<string, unknown> = {};
  const dp = row.definitionPath?.trim();
  if (dp !== undefined && dp !== '') {
    const abs = path.resolve(monorepoRoot, dp);
    let raw: string;
    try {
      raw = await fs.readFile(abs, 'utf8');
    } catch (e) {
      throw new Error(
        `无法读取目标定义文件（${abs}）：${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const parsedUnknown = YAML.parse(raw) as unknown;
    const fileParsed = targetProjectDefinitionFileSchema.safeParse(parsedUnknown);
    if (!fileParsed.success) {
      throw new Error(
        `目标定义 YAML 校验失败（${abs}）：${fileParsed.error.message}`,
      );
    }
    const fid = fileParsed.data.id?.trim();
    if (fid !== undefined && fid !== '' && fid !== row.id) {
      throw new Error(
        `定义文件 ${abs} 内 id「${fid}」与 agents.config.yaml 中该条目的 id「${row.id}」不一致`,
      );
    }
    base = { ...fileParsed.data };
    delete base.id;
  }

  const overlay = pickNonEmptyStringOverrides(row);
  const merged: Record<string, unknown> = { ...base, ...overlay, id: row.id };
  const wsRaw = merged.workspacePath;
  const ws =
    typeof wsRaw === 'string' ? wsRaw.trim() : '';
  if (ws === '') {
    throw new Error(
      `目标「${row.id}」缺少 workspacePath（请在定义文件或 agents.config.yaml 内联字段中填写）`,
    );
  }
  merged.workspacePath = ws;

  const ok = targetProjectEntrySchema.safeParse(merged);
  if (!ok.success) {
    throw new Error(
      `目标「${row.id}」合并后校验失败：${ok.error.message}`,
    );
  }
  return ok.data;
};

export const hydrateAgentsConfigTargetProjects = async (
  monorepoRoot: string,
  cfg: IAgentsConfigParsed,
): Promise<IAgentsConfig> => {
  const ps = cfg.target?.projects;
  if (ps === undefined || ps.length === 0) {
    return cfg as IAgentsConfig;
  }
  const resolved = await Promise.all(
    ps.map((row) => resolveOneTargetProject(monorepoRoot, row)),
  );
  return {
    ...cfg,
    target:
      cfg.target === undefined
        ? cfg.target
        : {
            ...cfg.target,
            projects: resolved,
          },
  } as IAgentsConfig;
};
