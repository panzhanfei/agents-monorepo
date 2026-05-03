import fs from 'node:fs';
import path from 'node:path';

import { extractCodeFenceFiles } from './code-fence-extract.js';
import { trySynthesizeFilesFromInstruction } from './coding-llm-implementation.js';
import { ensureParentDir, resolvePathUnderWorkspace } from './path-under-workspace.js';

const PROJECT_ROOT_MARKERS = [
  'package.json',
  'pnpm-workspace.yaml',
  'package-lock.json',
  'yarn.lock',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
  'requirements.txt',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'mix.exs',
];

export type ICodingWorkspaceApplyOptions = {
  readonly workspaceRoot: string;
  readonly taskId: string;
  readonly instruction: string;
  readonly workspaceLifecycleApplied: 'existing' | 'greenfield';
};

export type ICodingWorkspaceApplyResult = {
  readonly filesWrittenRelative: string[];
  readonly scaffoldApplied: boolean;
  readonly applyWarnings: string[];
  readonly applySummaryLines: string[];
};

const hasProjectManifest = (root: string): boolean =>
  PROJECT_ROOT_MARKERS.some((name) => fs.existsSync(path.join(root, name)));

const safeTaskSegment = (taskId: string): string =>
  taskId.replace(/[^a-zA-Z0-9._-]+/g, '_');

const writeUtf8 = async (
  abs: string,
  content: string,
  opts: { skipIfExists?: boolean }
): Promise<'written' | 'skipped' | 'error'> => {
  try {
    if (opts.skipIfExists === true && fs.existsSync(abs)) {
      return 'skipped';
    }
    await ensureParentDir(abs);
    await fs.promises.writeFile(abs, content, 'utf8');
    return 'written';
  } catch {
    return 'error';
  }
};

const posixRel = (root: string, abs: string): string =>
  path.relative(root, abs).split(path.sep).join('/');

const buildRequirementDocBody = (
  taskId: string,
  instruction: string
): string =>
  [
    `# Coding task ${taskId}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Merged requirement / instruction',
    '',
    instruction.trimEnd(),
    '',
    '---',
    '',
    '实现方式：由本机已配置的 `LLM_BASE_URL` + `LLM_MODEL`（未关闭 `CODING_STACK_LLM` 时）根据上文生成带路径的 Markdown 代码围栏并写入工作区；也可在消息中直接使用带路径的围栏，例如：',
    '',
    '```tsx file=app/components/Example.tsx',
    'export const Example = () => <span />;',
    '```',
    '',
    '或围栏首行：`// file: app/components/Example.tsx`',
    '',
  ].join('\n');

/**
 * 写入合并需求文档；解析消息内手填围栏；若无则调用 LLM 按正文生成围栏并落盘。
 * 不再内置固定脚手架模板或栈别启发式——新建工程亦由模型输出文件清单。
 */
export const applyCodingWorkspace = async (
  opts: ICodingWorkspaceApplyOptions
): Promise<ICodingWorkspaceApplyResult> => {
  const root = path.resolve(opts.workspaceRoot);
  const applyWarnings: string[] = [];
  const written = new Set<string>();

  const tryWrite = async (
    relPosix: string,
    content: string,
    skipIfExists?: boolean
  ): Promise<void> => {
    const abs = resolvePathUnderWorkspace(root, relPosix);
    if (abs === null) {
      applyWarnings.push(`拒绝写入（路径非法）：${relPosix}`);
      return;
    }
    const st = await writeUtf8(abs, content, { skipIfExists: skipIfExists === true });
    if (st === 'written') {
      written.add(posixRel(root, abs));
    } else if (st === 'error') {
      applyWarnings.push(`写入失败：${relPosix}`);
    }
  };

  const manifest = hasProjectManifest(root);

  /** `existing` 只校验「目录已存在」，与「是否已有工程清单」无关。 */
  const lifecycleExistingWithoutManifest =
    !manifest && opts.workspaceLifecycleApplied === 'existing';

  const reqRel = `docs/agents-coding/${safeTaskSegment(opts.taskId)}-REQUIREMENT.md`;
  await tryWrite(reqRel, buildRequirementDocBody(opts.taskId, opts.instruction), false);

  const manualFences = extractCodeFenceFiles(opts.instruction);
  let synthesizedNote: string | undefined;
  let fences = manualFences;
  if (manualFences.length === 0) {
    const syn = await trySynthesizeFilesFromInstruction(opts.instruction);
    fences = syn.fences;
    synthesizedNote = syn.llmNote;
    if (fences.length === 0 && synthesizedNote !== undefined) {
      applyWarnings.push(synthesizedNote);
    }
  }
  for (const f of fences) {
    await tryWrite(f.relPosixPath, f.content, false);
  }

  const filesWrittenRelative = [...written].sort();

  const lifecycleHintLines: string[] =
    lifecycleExistingWithoutManifest
      ? [
          '> **工作区说明**：策略 **existing** 表示「客户路径须事先存在」，**不**表示「已是完整工程」。当前目录未检测到常见清单文件时，仍只会写入需求文档并由 LLM/手填围栏生成文件。',
          '> 若要在**既有仓库**内迭代，请将 `workspacePath` 指向该仓库根。',
          '',
        ]
      : [];

  const hadManifestBefore = manifest;
  const manifestAfter = hasProjectManifest(root);

  const applySummaryLines: string[] = [
    '### 编码写入',
    '',
    ...lifecycleHintLines,
    `- **工作区策略**：${opts.workspaceLifecycleApplied}`,
    `- **内置模板脚手架**：否（新建或改动均由 LLM 按正文推断并输出围栏，或由消息内手填围栏）`,
    `- **检测到工程清单**：${hadManifestBefore ? '写入前已有' : manifestAfter ? '写入后出现' : '仍无'}`,
    ...(manualFences.length === 0 && fences.length > 0
      ? [
          `- **LLM 生成围栏**：已落盘 \`${String(fences.length)}\` 个文件`,
          '',
        ]
      : []),
    `- **写入文件数**：${String(filesWrittenRelative.length)}`,
    ...(filesWrittenRelative.length > 0
      ? [
          '',
          '**相对工作区路径：**',
          ...filesWrittenRelative.map((r) => `- \`${r}\``),
        ]
      : [
          '',
          '（本次除需求文档外无新文件 — 请配置 `LLM_BASE_URL` + `LLM_MODEL` 或在消息中附带带路径的代码块）',
        ]),
    ...(applyWarnings.length > 0
      ? ['', '**写入告警：**', ...applyWarnings.map((w) => `- ${w}`)]
      : []),
    '',
  ];

  return {
    filesWrittenRelative,
    scaffoldApplied: false,
    applyWarnings,
    applySummaryLines,
  };
};
