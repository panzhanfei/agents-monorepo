import {
  chatCompletionText,
  LlmTransportError,
} from '../clients/llm-openai-compatible.js';
import {
  getCodingLlmEnvConfig,
  isCodingStackLlmEnabled,
} from '../config/llm-env.js';
import {
  type ICodingScaffoldStackId,
  isCodingScaffoldStackId,
  codingStackListForLlmPrompt,
} from './coding-scaffold-ids.js';

const buildSystemPrompt = (): string =>
  `You choose exactly ONE scaffold id for a new software project from the user's requirement. Prefer explicit stack names if the user states them.

Valid stack ids — the JSON "stack" field must equal one of these strings exactly:
${codingStackListForLlmPrompt()}

Output ONLY one JSON object, no markdown fences: {"stack":"<id>","reason":"<short rationale>"}
If the requirement is too vague, choose the closest reasonable stack or "node-esm-minimal" only when nothing else fits.`;

const parseJsonObject = (
  text: string
): { stack?: string; reason?: string } | null => {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  const body = fence !== null ? fence[1]!.trim() : t;
  try {
    return JSON.parse(body) as { stack?: string; reason?: string };
  } catch {
    return null;
  }
};

type IHeuristicRule = {
  readonly re: RegExp;
  readonly stack: ICodingScaffoldStackId;
};

const HEURISTIC_RULES: readonly IHeuristicRule[] = [
  {
    re: /next\s*技术栈|next\s*脚手架|next\s*框架/i,
    stack: 'next-app-router',
  },
  {
    re: /(?:采用|使用|基于)\s*next(?:\.?\s*js)?\b/i,
    stack: 'next-app-router',
  },
  {
    re: /\b(next\.?js|nextjs|next\s+js|app\s*router)\b/i,
    stack: 'next-app-router',
  },
  { re: /\bnuxt\b/i, stack: 'nuxt3-minimal' },
  {
    re: /\b(vue\.?js|vue\s*3|vite\s*[^\n]*vue|pinia)\b/i,
    stack: 'vue-vite-spa',
  },
  { re: /\b(react|vite\s*[^\n]*react|react-dom)\b/i, stack: 'react-vite-spa' },
  { re: /\b(express|fastify)\b/i, stack: 'express-typescript' },
  {
    re: /\b(node(\.js)?|无框架|命令行|cli|工具脚本)\b/i,
    stack: 'node-esm-minimal',
  },
];

export const resolveStackHeuristic = (
  instruction: string
): { stack: ICodingScaffoldStackId; rationale: string } | undefined => {
  for (const r of HEURISTIC_RULES) {
    if (r.re.test(instruction)) {
      return {
        stack: r.stack,
        rationale: `需求关键词匹配 → \`${r.stack}\``,
      };
    }
  }
  return undefined;
};

export type ICodingStackResolution = {
  readonly source: 'llm' | 'heuristic' | 'undetermined';
  readonly stackId?: ICodingScaffoldStackId;
  readonly rationale?: string;
  readonly llmNote?: string;
};

export const resolveCodingStack = async (
  instruction: string
): Promise<ICodingStackResolution> => {
  const heuristicFirst = resolveStackHeuristic(instruction);

  if (isCodingStackLlmEnabled()) {
    const cfg = getCodingLlmEnvConfig();
    try {
      const raw = await chatCompletionText(cfg, [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: `Project requirement / 需求说明：\n\n${instruction.slice(0, 24_000)}`,
        },
      ]);
      const obj = parseJsonObject(raw);
      const id = typeof obj?.stack === 'string' ? obj.stack.trim() : '';
      if (isCodingScaffoldStackId(id)) {
        if (
          heuristicFirst !== undefined &&
          heuristicFirst.stack !== id
        ) {
          return {
            source: 'heuristic',
            stackId: heuristicFirst.stack,
            rationale: `${heuristicFirst.rationale}（覆盖模型选型）`,
            llmNote: `模型返回 \`${id}\`，已与需求关键词对齐为 \`${heuristicFirst.stack}\``,
          };
        }
        return {
          source: 'llm',
          stackId: id,
          rationale:
            typeof obj?.reason === 'string' && obj.reason.trim() !== ''
              ? obj.reason.trim()
              : '模型返回选型',
        };
      }
      if (heuristicFirst !== undefined) {
        return {
          source: 'heuristic',
          stackId: heuristicFirst.stack,
          rationale: `模型 JSON 无效（${id !== '' ? id : '缺 stack'}），回退关键词：${heuristicFirst.rationale}`,
          llmNote: 'LLM 返回的 stack 不在允许列表，已回退启发式',
        };
      }
      return {
        source: 'undetermined',
        rationale: '模型未给出合法 stack，且需求中无识别到的技术关键词',
        llmNote: 'LLM 输出未解析为合法 stack',
      };
    } catch (e) {
      const msg = e instanceof LlmTransportError ? e.message : String(e);
      if (heuristicFirst !== undefined) {
        return {
          source: 'heuristic',
          stackId: heuristicFirst.stack,
          rationale: heuristicFirst.rationale,
          llmNote: `LLM 失败，已用关键词：${msg.slice(0, 200)}`,
        };
      }
      return {
        source: 'undetermined',
        rationale: 'LLM 不可用且无关键词命中；仅写入需求文档',
        llmNote: msg.slice(0, 240),
      };
    }
  }

  if (heuristicFirst !== undefined) {
    return {
      source: 'heuristic',
      stackId: heuristicFirst.stack,
      rationale: heuristicFirst.rationale,
    };
  }
  return {
    source: 'undetermined',
    rationale:
      '未配置 LLM（需 `LLM_BASE_URL` + `LLM_MODEL`，且勿将 `CODING_STACK_LLM` 设为 `0`）且需求未命中技术关键词；仅写入需求文档。可在需求中写明技术栈（如 Next.js、Vue+Vite）。',
  };
};
