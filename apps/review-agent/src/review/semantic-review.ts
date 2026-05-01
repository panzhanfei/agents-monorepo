import { z } from 'zod';
import type {
  IReviewFinding,
  IReviewLlmSlice,
  IReviewRunRequest,
} from '@agents/pipeline-core';
import type { ILlmEnvConfig } from '../config/env.js';
import {
  chatCompletionText,
  LlmTransportError,
} from '../clients/llm-openai-compatible.js';
import { REVIEW_LLM_SYSTEM_PROMPT } from './review-llm-prompt.js';

const jsonShape = z.object({
  blocking: z.array(
    z.object({
      rule: z.string().optional(),
      message: z.string(),
    })
  ),
  warnings: z.array(
    z.object({
      rule: z.string().optional(),
      message: z.string(),
    })
  ),
  summary: z.string(),
});

const stripJsonFence = (text: string): string => {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/\n?```\s*$/u, '').trim();
  }
  return t;
};

const tailText = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max)}…`;

const parseReviewJson = (
  rawText: string
):
  | { ok: true; data: z.infer<typeof jsonShape> }
  | { ok: false; excerpt: string } => {
  try {
    const stripped = stripJsonFence(rawText);
    const parsedJson: unknown = JSON.parse(stripped);
    const parsed = jsonShape.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, excerpt: tailText(rawText, 6000) };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, excerpt: tailText(rawText, 6000) };
  }
};

const toFindings = (
  rows: readonly { rule?: string; message: string }[],
  severity: 'blocking' | 'warning'
): IReviewFinding[] =>
  rows.map((r) => ({
    rule: r.rule,
    message: r.message,
    severity,
  }));

export const runSemanticReview = async (opts: {
  readonly llm: ILlmEnvConfig;
  readonly taskId: string;
  readonly input: IReviewRunRequest;
  readonly rulesBundle: string;
}): Promise<IReviewLlmSlice> => {
  const ctxParts = [
    `taskId：${opts.taskId}`,
    opts.input.implementationRole !== undefined
      ? `implementationRole：${opts.input.implementationRole}`
      : '',
    opts.input.stackProfile !== undefined
      ? `stackProfile：${opts.input.stackProfile}`
      : '',
    opts.input.changeSummary !== undefined
      ? `变更摘要：\n${opts.input.changeSummary}`
      : '',
    opts.input.diffText !== undefined ? `diff（节选）：\n${opts.input.diffText}` : '',
    '',
    '=== 规则与配置文件片段 ===',
    opts.rulesBundle === '' ? '（未加载到规则文件：请检查 glob / 路径）' : opts.rulesBundle,
  ].filter((x) => x !== '');

  const userPrompt = ctxParts.join('\n');

  let text = '';
  let attempt = 0;
  const maxAttempts = opts.llm.maxRetries + 1;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const suffix =
        attempt > 1
          ? '\n\n上一轮流式输出无法解析为 JSON，请严格输出单个 JSON 对象（勿使用 markdown 围栏）。'
          : '';
      text = await chatCompletionText(opts.llm, [
        { role: 'system', content: REVIEW_LLM_SYSTEM_PROMPT },
        { role: 'user', content: `${userPrompt}${suffix}` },
      ]);
      break;
    } catch (e) {
      if (e instanceof LlmTransportError && attempt >= maxAttempts) {
        throw e;
      }
      if (!(e instanceof LlmTransportError) && attempt >= maxAttempts) {
        throw e;
      }
    }
  }

  const parsed = parseReviewJson(text);
  if (!parsed.ok) {
    return {
      skipped: false,
      blocking: [
        {
          severity: 'blocking',
          rule: 'review-json-parse',
          message:
            '模型输出无法解析为合法 JSON；请重试或更换模型。以下为原始节选。',
        },
      ],
      warnings: [],
      summaryMarkdown: `\`\`\`text\n${parsed.excerpt}\n\`\`\``,
    };
  }

  return {
    skipped: false,
    blocking: toFindings(parsed.data.blocking, 'blocking'),
    warnings: toFindings(parsed.data.warnings, 'warning'),
    summaryMarkdown: parsed.data.summary,
  };
};
