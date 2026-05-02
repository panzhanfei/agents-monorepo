import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  CUSTOMER_TARGETS_ROOT_REL,
} from '@agents/agents-config';
import { loadReviewRulesBundle } from './load-rules.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d !== undefined) {
      rmSync(d, { recursive: true, force: true });
    }
  }
});

describe('loadReviewRulesBundle orchestration dirs', () => {
  it('includes files from customer-targets/<id>/ai-rules under monorepo root', async () => {
    const mono = mkdtempSync(path.join(os.tmpdir(), 'review-mono-'));
    tmpDirs.push(mono);

    const ws = mkdtempSync(path.join(mono, 'ws-'));
    const orchDir = path.join(
      mono,
      CUSTOMER_TARGETS_ROOT_REL,
      'svc-a',
      CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
    );
    mkdirSync(orchDir, { recursive: true });
    writeFileSync(
      path.join(orchDir, 'extra.mdc'),
      'from-orch\n',
      'utf8',
    );

    mkdirSync(path.join(ws, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      path.join(ws, '.cursor', 'rules', 'in-repo.mdc'),
      'workspace\n',
      'utf8',
    );

    const bundle = await loadReviewRulesBundle({
      workspaceRoot: ws,
      aiRulesGlob: '.cursor/rules/**/*.mdc',
      customerRulesDir: '__none__',
      extraRelativeFiles: [],
      monorepoRoot: mono,
      orchestrationRuleDirs: [orchDir],
      maxChars: 50_000,
    });

    expect(bundle).toContain('workspace');
    expect(bundle).toContain('from-orch');
    expect(bundle).toContain(
      `${CUSTOMER_TARGETS_ROOT_REL}/svc-a/${CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT}`,
    );
  });

  it('workspaceRuleTreesSkipped omits workspace glob/customer dirs', async () => {
    const mono = mkdtempSync(path.join(os.tmpdir(), 'review-mono-sk-'));
    tmpDirs.push(mono);

    const ws = mkdtempSync(path.join(mono, 'ws-sk-'));
    const orchDir = path.join(
      mono,
      CUSTOMER_TARGETS_ROOT_REL,
      'svc-b',
      CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
    );
    mkdirSync(orchDir, { recursive: true });
    writeFileSync(
      path.join(orchDir, 'only-orch.mdc'),
      'orch-only\n',
      'utf8',
    );

    mkdirSync(path.join(ws, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      path.join(ws, '.cursor', 'rules', 'skip-me.mdc'),
      'never\n',
      'utf8',
    );

    const bundle = await loadReviewRulesBundle({
      workspaceRoot: ws,
      aiRulesGlob: '.cursor/rules/**/*.mdc',
      customerRulesDir: '__none__',
      extraRelativeFiles: [],
      monorepoRoot: mono,
      orchestrationRuleDirs: [orchDir],
      workspaceRuleTreesSkipped: true,
      maxChars: 50_000,
    });

    expect(bundle).toContain('orch-only');
    expect(bundle).not.toContain('never');
  });
});
