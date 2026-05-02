import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateCodingWorkspaceConfigAsync } from './coding-workspace-eval.js';

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('evaluateCodingWorkspaceConfigAsync', () => {
  it('flags missing workspace directory', async () => {
    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot,
      workspaceAbsolute:
        '/definitely-nonexistent/workspace-' +
        String(Date.now()),
    });

    expect(report.blockingIssues).toHaveLength(1);
    expect(report.blockingIssues[0]?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(false);
  });

  it('without target id does not suggest upload-only confirm', async () => {
    const ws = mkdtempSync(path.join(os.tmpdir(), 'coding-eval-'));
    tmpDirs.push(ws);

    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot,
      workspaceAbsolute: ws,
    });

    expect(report.blockingIssues).toHaveLength(0);
    expect(report.workspaceAiRuleFilesMatchedCount).toBe(0);
    expect(report.orchestrationAiRuleFilesMatchedCount).toBe(0);
    expect(report.aiRuleFilesMatchedCount).toBe(0);
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(false);
    expect(report.aiRulesGlobEffective).toContain(
      '缺少 customerTargetProjectId',
    );
  });

  it('reports missing-orchestration when target id bound but folder empty', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'coding-eval-bound-'));
    tmpDirs.push(root);
    writeFileSync(
      path.join(root, 'agents.config.yaml'),
      [
        'pipeline:',
        '  fullTestCommand: echo',
        'review:',
        '  activeProfile: px',
        '  profiles:',
        '    px:',
        '      aiRulesGlob: "*.md"',
        '      customerRulesDir: rr',
        '      blockingCommands: []',
      ].join('\n'),
      'utf8',
    );
    const ws = mkdtempSync(path.join(root, 'ws-bound-'));

    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot: root,
      workspaceAbsolute: ws,
      customerTargetProjectId: 'svcEmpty',
    });

    expect(report.blockingIssues).toHaveLength(0);
    expect(report.orchestrationAiRuleFilesMatchedCount).toBe(0);
    expect(report.aiRuleFilesMatchedCount).toBe(0);
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(true);
  });

  it('counts customer-targets/<id>/ai-rules when customerTargetProjectId is set', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'orch-ai-rules-eval-'));
    tmpDirs.push(root);
    writeFileSync(
      path.join(root, 'agents.config.yaml'),
      [
        'pipeline:',
        '  fullTestCommand: echo',
        'review:',
        '  activeProfile: px',
        '  profiles:',
        '    px:',
        '      aiRulesGlob: __no_match__/nope.md',
        '      customerRulesDir: zz',
        '      blockingCommands: []',
      ].join('\n'),
      'utf8',
    );
    const ws = mkdtempSync(path.join(root, 'ws-inner-'));
    mkdirSync(path.join(root, 'customer-targets', 'svc1', 'ai-rules'), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, 'customer-targets', 'svc1', 'ai-rules', 'rules.mdc'),
      'orc',
      'utf8',
    );

    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot: root,
      workspaceAbsolute: ws,
      customerTargetProjectId: 'svc1',
    });

    expect(report.blockingIssues).toHaveLength(0);
    expect(report.workspaceAiRuleFilesMatchedCount).toBe(0);
    expect(report.orchestrationAiRuleFilesMatchedCount).toBe(1);
    expect(report.aiRuleFilesMatchedCount).toBe(1);
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(false);
  });
});
