import {
  chatCompletionText,
  LlmTransportError,
} from '../clients/llm-openai-compatible.js';
import {
  getCodingLlmEnvConfig,
  isCodingStackLlmEnabled,
} from '../config/llm-env.js';
import {
  extractCodeFenceFiles,
  type ICodeFenceFileHint,
} from './code-fence-extract.js';

const buildImplementationSystemPrompt = (): string =>
  [
    'You are a senior software engineer. You receive a coding task as natural language, sometimes with a merged product-requirement appendix (PRD) at the end.',
    '',
    'Output ONLY Markdown consisting of fenced code blocks. Do not write prose outside fences.',
    '',
    'Each fence MUST declare a workspace-relative path on the opening line, for example:',
    '- ```ts file=src/index.ts',
    '- ```tsx file=app/page.tsx',
    '- ```css file=app/globals.css',
    '- ```json file=package.json',
    '- ```toml file=Cargo.toml',
    '',
    'Decide entirely from the task text:',
    '- **Existing project**: change or add only what is needed; prefer minimal diffs; do not replace working pages with placeholder marketing copy unless the task asks for a rewrite.',
    '- **New project / empty workspace**: emit the minimal runnable set of files for the stack implied by the task (including manifests such as package.json when relevant).',
    '- When the appendix lists factual data (contacts, employers, dates), copy verbatim; do not mask or invent placeholders when real values are already given.',
    '- Do not emit lockfiles (package-lock.json, pnpm-lock.yaml, yarn.lock) unless the user explicitly requests them.',
    '- Every import must refer to a file you emit in the same response or to dependencies declared in a manifest you emit.',
  ].join('\n');

export type ICodingLlmImplementationResult = {
  readonly fences: ICodeFenceFileHint[];
  readonly llmNote?: string;
};

/**
 * 启用 LLM 时：根据**整条指令（含可选 PRD 附录）**生成带 `file=` 路径的代码围栏，由调用方解析落盘。
 * 不设栈别、样式或工作区探测等门禁——全部由模型按正文推断。
 */
export const trySynthesizeFilesFromInstruction = async (
  instruction: string
): Promise<ICodingLlmImplementationResult> => {
  if (!isCodingStackLlmEnabled()) {
    return { fences: [] };
  }

  const baseCfg = getCodingLlmEnvConfig();
  const implRaw = process.env.CODING_IMPLEMENTATION_LLM_TIMEOUT_MS?.trim();
  const timeoutMs =
    implRaw !== undefined && implRaw !== '' && !Number.isNaN(Number(implRaw))
      ? Number(implRaw)
      : Math.max(baseCfg.timeoutMs, 240_000);
  const cfg = { ...baseCfg, timeoutMs };

  try {
    const raw = await chatCompletionText(cfg, [
      { role: 'system', content: buildImplementationSystemPrompt() },
      {
        role: 'user',
        content: `Implement the task below. If a PRD appendix is present at the end, follow it together with the lead instructions.\n\n${instruction.slice(0, 48_000)}`,
      },
    ]);
    const fences = extractCodeFenceFiles(raw);
    if (fences.length === 0) {
      return {
        fences: [],
        llmNote: '实现阶段 LLM 返回内容中未解析到带 file= 路径的代码围栏',
      };
    }
    return { fences };
  } catch (e) {
    const msg = e instanceof LlmTransportError ? e.message : String(e);
    return {
      fences: [],
      llmNote: `实现阶段 LLM 失败：${msg.slice(0, 280)}`,
    };
  }
};
