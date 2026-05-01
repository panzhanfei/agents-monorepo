import { describe, expect, it } from 'vitest';
import type { IAgentsConfig } from './schema.js';
import {
  extractLeadingTargetDirective,
  parseSelectTargetMessage,
  resolveFeishuTaskWorkspace,
  resolveLegacyTargetWorkspace,
} from './resolve-feishu-task-target.js';

const mono = '/agents-monorepo';

const baseCfg: IAgentsConfig = {
  pipeline: { fullTestCommand: 'pnpm test', publishCommand: 'pnpm build' },
  review: {
    activeProfile: 'default',
    profiles: {
      default: {
        aiRulesGlob: '**/*.md',
        customerRulesDir: './r',
        blockingCommands: ['pnpm lint'],
      },
    },
  },
};

describe('resolve-feishu-task-target', () => {
  it('resolveLegacy prefers env TARGET_WORKSPACE_PATH over yaml', () => {
    expect(
      resolveLegacyTargetWorkspace(
        mono,
        { TARGET_WORKSPACE_PATH: '/env/abs' },
        './yaml-only'
      )
    ).toBe('/env/abs');
  });

  it('resolveLegacy uses yaml workspace when env empty', () => {
    expect(
      resolveLegacyTargetWorkspace(mono, {}, './workspace/y')
    ).toBe(`${mono}/workspace/y`);
  });

  it('resolveFeishuTaskWorkspace returns ambiguous when multi target and no picker', () => {
    const cfg: IAgentsConfig = {
      ...baseCfg,
      target: {
        workspacePath: './workspace/target-repo',
        projects: [
          { id: 'a', workspacePath: './w/a' },
          { id: 'b', workspacePath: './w/b' },
        ],
      },
    };
    const r = resolveFeishuTaskWorkspace(mono, {}, cfg, {});
    expect(r).toEqual({ kind: 'ambiguous', ids: ['a', 'b'] });
  });

  it('resolveFeishuTaskWorkspace picks sole project automatically', () => {
    const cfg: IAgentsConfig = {
      ...baseCfg,
      target: {
        projects: [{ id: 'only', workspacePath: './solo' }],
      },
    };
    const r = resolveFeishuTaskWorkspace(mono, {}, cfg, {});
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.targetProjectId).toBe('only');
      expect(r.workspacePathAbsolute).toBe(`${mono}/solo`);
    }
  });

  it('extractLeadingTargetDirective strips first line multiline target', () => {
    const { rest, targetId } = extractLeadingTargetDirective(
      '目标：a\n编码：你好'
    );
    expect(targetId).toBe('a');
    expect(rest).toBe('编码：你好');
  });

  it('extractLeadingTargetDirective leaves single-line body unchanged', () => {
    const t = '编码：单行';
    expect(extractLeadingTargetDirective(t)).toEqual({ rest: t });
  });

  it('parseSelectTargetMessage parses 切换目标', () => {
    expect(parseSelectTargetMessage('切换目标：app_1')).toBe('app_1');
    expect(parseSelectTargetMessage('指令：绑定目标 x-y')).toBe('x-y');
  });
});
