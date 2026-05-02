import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractCodeFenceFiles } from './code-fence-extract.js';
import { applyCodingWorkspace } from './coding-workspace-apply.js';

const saveEnv = (keys: string[]): Record<string, string | undefined> => {
  const o: Record<string, string | undefined> = {};
  for (const k of keys) {
    o[k] = process.env[k];
  }
  return o;
};

const restoreEnv = (
  keys: string[],
  prev: Record<string, string | undefined>
): void => {
  for (const k of keys) {
    const v = prev[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
};

const envKeys = ['CODING_STACK_LLM', 'LLM_MODEL', 'LLM_BASE_URL'];

describe('extractCodeFenceFiles', () => {
  it('reads file= hint on fence', () => {
    const src = [
      'Intro',
      '',
      '```js file=src/a.js',
      'export const n = 1;',
      '```',
    ].join('\n');
    const r = extractCodeFenceFiles(src);
    expect(r).toEqual([{ relPosixPath: 'src/a.js', content: 'export const n = 1;' }]);
  });

  it('reads // file: on first line', () => {
    const src = ['```ts', '// file: lib/x.ts', 'export const x = 2;', '```'].join(
      '\n'
    );
    const r = extractCodeFenceFiles(src);
    expect(r).toEqual([{ relPosixPath: 'lib/x.ts', content: 'export const x = 2;' }]);
  });

  it('ignores fences without path', () => {
    expect(extractCodeFenceFiles('```js\nconsole.log(1)\n```')).toEqual([]);
  });

  it('extracts relative path containing .. for downstream rejection', () => {
    const src = ['```js file=../evil.js', 'x', '```'].join('\n');
    const r = extractCodeFenceFiles(src);
    expect(r[0]?.relPosixPath).toBe('../evil.js');
  });
});

describe('applyCodingWorkspace', () => {
  let prevEnv: Record<string, string | undefined>;

  beforeEach(() => {
    prevEnv = saveEnv(envKeys);
    process.env.CODING_STACK_LLM = '0';
    delete process.env.LLM_MODEL;
    delete process.env.LLM_BASE_URL;
  });

  afterEach(() => {
    restoreEnv(envKeys, prevEnv);
  });

  it('scaffolds Next when instruction mentions Next (heuristic)', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't1',
      instruction: '用 Next.js 做简历网站',
      workspaceLifecycleApplied: 'greenfield',
    });
    expect(res.scaffoldApplied).toBe(true);
    expect(res.stackChoice?.source).toBe('heuristic');
    expect(res.stackChoice?.stackId).toBe('next-app-router');
    expect(res.filesWrittenRelative).toContain('package.json');
    expect(res.filesWrittenRelative).toContain('app/page.tsx');
    expect(
      res.filesWrittenRelative.some((f) => f.endsWith('REQUIREMENT.md'))
    ).toBe(true);
    const pkg = JSON.parse(
      await fs.promises.readFile(path.join(tmp, 'package.json'), 'utf8')
    ) as { dependencies?: { next?: string } };
    expect(pkg.dependencies?.next).toBeDefined();
    const nc = await fs.promises.readFile(path.join(tmp, 'next.config.ts'), 'utf8');
    expect(nc).toContain("output: 'export'");
    expect(res.filesWrittenRelative).toContain('app/not-found.tsx');
  });

  it('scaffolds Next when lead line is vague but PRD appendix names Next.js', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    const instruction = [
      '编码：按引用消息的需求。',
      '',
      '---',
      '',
      '## 关联需求文档（PRD）',
      '',
      '使用 Next.js 构建静态站点（SSG），注重 SEO。',
    ].join('\n');
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't-merge',
      instruction,
      workspaceLifecycleApplied: 'greenfield',
    });
    expect(res.stackChoice?.stackId).toBe('next-app-router');
    expect(res.filesWrittenRelative).toContain('app/layout.tsx');
  });

  it('scaffolds Next for Chinese cue \"next技术栈\"', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't-zh',
      instruction: '个人网站 SEO；采用next技术栈与静态导出',
      workspaceLifecycleApplied: 'greenfield',
    });
    expect(res.stackChoice?.stackId).toBe('next-app-router');
  });

  it('only requirement when no stack signal and LLM off', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't-vague',
      instruction: '随便实现一下',
      workspaceLifecycleApplied: 'greenfield',
    });
    expect(res.scaffoldApplied).toBe(false);
    expect(res.stackChoice?.source).toBe('undetermined');
    expect(res.filesWrittenRelative.every((f) => f.endsWith('REQUIREMENT.md'))).toBe(
      true
    );
  });

  it('skips scaffold when package.json exists; writes requirement + fence file', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    await fs.promises.writeFile(
      path.join(tmp, 'package.json'),
      '{"name":"x","private":true}\n',
      'utf8'
    );
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't2',
      instruction: [
        'Add util',
        '',
        '```js file=src/util.js',
        'export const add = (a,b)=>a+b;',
        '```',
      ].join('\n'),
      workspaceLifecycleApplied: 'existing',
    });
    expect(res.scaffoldApplied).toBe(false);
    expect(res.stackChoice).toBeUndefined();
    expect(res.filesWrittenRelative).toContain('src/util.js');
    const util = await fs.promises.readFile(
      path.join(tmp, 'src/util.js'),
      'utf8'
    );
    expect(util).toContain('export const add');
  });

  it('records warning for traversal path', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'coding-apply-'));
    await fs.promises.writeFile(
      path.join(tmp, 'package.json'),
      '{"name":"x","private":true}\n',
      'utf8'
    );
    const res = await applyCodingWorkspace({
      workspaceRoot: tmp,
      taskId: 't3',
      instruction: ['```js file=../../escape.js', '1', '```'].join('\n'),
      workspaceLifecycleApplied: 'existing',
    });
    expect(res.applyWarnings.some((w) => w.includes('路径非法'))).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, '..', '..', 'escape.js'))
    ).toBe(false);
  });
});
