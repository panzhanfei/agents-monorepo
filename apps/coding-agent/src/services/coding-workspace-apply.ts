import fs from 'node:fs';
import path from 'node:path';

import type { ICodingStackChoice } from '@agents/pipeline-core';

import { extractCodeFenceFiles } from './code-fence-extract.js';
import { ensureParentDir, resolvePathUnderWorkspace } from './path-under-workspace.js';
import { CODING_STACK_LABELS, isCodingScaffoldStackId } from './coding-scaffold-ids.js';
import { getScaffoldPieces } from './coding-scaffold-templates.js';
import { resolveCodingStack } from './coding-stack-resolve.js';

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
  readonly stackChoice?: ICodingStackChoice;
};

const hasProjectManifest = (root: string): boolean =>
  PROJECT_ROOT_MARKERS.some((name) => fs.existsSync(path.join(root, name)));

const npmPackageNameSafe = (dirBasename: string): string => {
  const s = dirBasename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '');
  return s !== '' ? s.slice(0, 214) : 'customer-project';
};

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
    '可在需求中写明技术栈（Next / Vue / React / Nuxt / Express 等），或由本机已配置的 `LLM_BASE_URL` + `LLM_MODEL` 自动选型；也可使用带路径的 Markdown 代码围栏落盘，例如：',
    '',
    '```tsx file=app/components/Example.tsx',
    'export const Example = () => <span />;',
    '```',
    '',
    '或围栏首行：`// file: app/components/Example.tsx`',
    '',
  ].join('\n');

/**
 * 配置自检通过后：按**需求+可选 LLM** 选型脚手架、合并需求落盘、解析围栏写入。
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
  let scaffoldApplied = false;
  let stackChoice: ICodingStackChoice | undefined;

  const reqRel = `docs/agents-coding/${safeTaskSegment(opts.taskId)}-REQUIREMENT.md`;

  if (!manifest) {
    const resolution = await resolveCodingStack(opts.instruction);
    stackChoice = {
      source: resolution.source,
      ...(resolution.stackId !== undefined ? { stackId: resolution.stackId } : {}),
      ...(resolution.rationale !== undefined && resolution.rationale !== ''
        ? { rationale: resolution.rationale }
        : {}),
      ...(resolution.llmNote !== undefined && resolution.llmNote !== ''
        ? { llmNote: resolution.llmNote }
        : {}),
    };

    const pkgName = npmPackageNameSafe(path.basename(root));
    const pieces =
      resolution.stackId !== undefined
        ? getScaffoldPieces(resolution.stackId, {
            taskId: opts.taskId,
            name: pkgName,
          })
        : [];

    scaffoldApplied = resolution.stackId !== undefined;

    for (const p of pieces) {
      await tryWrite(p.rel, p.content, p.skipIfExists);
    }

    await tryWrite(
      reqRel,
      buildRequirementDocBody(opts.taskId, opts.instruction),
      false
    );
  } else {
    await tryWrite(
      reqRel,
      buildRequirementDocBody(opts.taskId, opts.instruction),
      false
    );
  }

  const fences = extractCodeFenceFiles(opts.instruction);
  for (const f of fences) {
    await tryWrite(f.relPosixPath, f.content, false);
  }

  const filesWrittenRelative = [...written].sort();

  const stackLine =
    stackChoice !== undefined
      ? [
          `- **技术栈选型**：${stackChoice.source}${
            stackChoice.stackId !== undefined &&
            isCodingScaffoldStackId(stackChoice.stackId)
              ? ` · \`${stackChoice.stackId}\`（${CODING_STACK_LABELS[stackChoice.stackId]}）`
              : stackChoice.stackId !== undefined
                ? ` · \`${stackChoice.stackId}\``
                : ''
          }`,
          stackChoice.rationale !== undefined && stackChoice.rationale !== ''
            ? `  - ${stackChoice.rationale}`
            : '',
          stackChoice.llmNote !== undefined && stackChoice.llmNote !== ''
            ? `  - LLM：${stackChoice.llmNote}`
            : '',
        ]
          .filter((l) => l !== '')
          .join('\n')
      : '';

  const applySummaryLines: string[] = [
    '### 编码写入',
    '',
    `- **工作区策略**：${opts.workspaceLifecycleApplied}`,
    ...(stackLine !== '' ? [stackLine, ''] : []),
    `- **新项目脚手架**：${
      scaffoldApplied
        ? '是（按选型落地模板；需本地 `npm install` / `pnpm install`）'
        : manifest
          ? '否（已有工程清单）'
          : '否（未识别技术栈且无可用 LLM 时仅需求文档；请补关键词或配置 LLM）'
    }`,
    `- **写入文件数**：${String(filesWrittenRelative.length)}`,
    ...(filesWrittenRelative.length > 0
      ? [
          '',
          '**相对工作区路径：**',
          ...filesWrittenRelative.map((r) => `- \`${r}\``),
        ]
      : [
          '',
          '（本次无新文件 — 可补充技术栈关键词或 `LLM_MODEL`，或使用带路径的 Markdown 代码块）',
        ]),
    ...(applyWarnings.length > 0
      ? ['', '**写入告警：**', ...applyWarnings.map((w) => `- ${w}`)]
      : []),
    '',
  ];

  return {
    filesWrittenRelative,
    scaffoldApplied,
    applyWarnings,
    applySummaryLines,
    ...(stackChoice !== undefined ? { stackChoice } : {}),
  };
};
