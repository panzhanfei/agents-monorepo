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

  it('suggests customer confirm when no ai rule files under workspace', async () => {
    const ws = mkdtempSync(path.join(os.tmpdir(), 'coding-eval-'));
    tmpDirs.push(ws);

    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot,
      workspaceAbsolute: ws,
    });

    expect(report.blockingIssues).toHaveLength(0);
    expect(report.aiRuleFilesMatchedCount).toBe(0);
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(true);
  });

  it('counts files matching aiRulesGlob from agents.config', async () => {
    const ws = mkdtempSync(path.join(os.tmpdir(), 'coding-eval-rules-'));
    tmpDirs.push(ws);
    mkdirSync(path.join(ws, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      path.join(ws, '.cursor', 'rules', 'sample.mdc'),
      'rule-body',
      'utf8'
    );

    const report = await evaluateCodingWorkspaceConfigAsync({
      monorepoRoot,
      workspaceAbsolute: ws,
    });

    expect(report.blockingIssues).toHaveLength(0);
    expect(report.aiRuleFilesMatchedCount).toBeGreaterThanOrEqual(1);
    expect(report.suggestCustomerConfirmWithoutMatchedAiRules).toBe(false);
  });
});
