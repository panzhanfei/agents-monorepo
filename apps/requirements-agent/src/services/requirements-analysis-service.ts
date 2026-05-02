import type { ILogger } from '@agents/logger';
import type {
  IRequirementsAnalysisRequest,
  IRequirementsAnalysisResponse,
} from '@agents/pipeline-core';
import type { ILlmEnvConfig } from '../config/env.js';
import type { ILlmChatMessage } from '../clients/llm-openai-compatible.js';
import { chatCompletionText } from '../clients/llm-openai-compatible.js';
import { REQUIREMENTS_PRD_SYSTEM_PROMPT } from '../prompts/prd-system.js';
import {
  stripTrailingPrdStatusLine,
  validatePrdMarkdownStructure,
} from './markdown-structure.js';

export type IRequirementsAnalysisDeps = {
  readonly logger: ILogger;
  readonly llm: ILlmEnvConfig;
};

const buildUserPrompt = (
  input: IRequirementsAnalysisRequest
): string => {
  const mode = input.mode ?? 'create';
  const hasImages = (input.imageAttachments?.length ?? 0) > 0;
  const imageTail =
    hasImages === true
      ? [
          '',
          '（用户另附了截图/图片，请结合图片中的界面与文字一并理解需求。）',
        ]
      : [];
  const stackSection =
    input.targetStackTargets !== undefined &&
    input.targetStackTargets.length > 0
      ? [
          '下列「目标栈」须在 PRD 中体现其对范围的影响（勿编造未提及功能）：',
          JSON.stringify(input.targetStackTargets, undefined, 2),
          '',
        ].join('\n')
      : '';

  if (mode === 'revise' && input.priorPrdMarkdown !== undefined) {
    return [
      `taskId（追溯用）：${input.taskId}`,
      '',
      '【模式】修订：将「上一版 PRD」与「用户本次补充」合并为一份新的完整 PRD（必须包含全部必选二级标题；不得只输出摘要）。',
      '',
      '## 上一版 PRD',
      '',
      input.priorPrdMarkdown.trim(),
      '',
      '## 用户本次补充 / 澄清',
      '',
      input.rawRequirement.trim(),
      '',
      stackSection,
      '请输出合并后的完整 PRD Markdown，并在正文内用「### 本版相对上一版的主要变更」列出变更要点。',
      ...imageTail,
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  return [
    `taskId（追溯用）：${input.taskId}`,
    '',
    '原始需求：',
    input.rawRequirement.trim(),
    '',
    stackSection,
    '请输出符合系统规则的完整 PRD Markdown。',
    ...imageTail,
  ]
    .filter((line) => line !== '')
    .join('\n');
};

const buildLlmMessages = (
  input: IRequirementsAnalysisRequest
): readonly ILlmChatMessage[] => {
  const userText = buildUserPrompt(input);
  const imgs = input.imageAttachments ?? [];

  if (imgs.length === 0) {
    return [
      { role: 'system', content: REQUIREMENTS_PRD_SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ];
  }

  return [
    { role: 'system', content: REQUIREMENTS_PRD_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...imgs.map((img) => ({
          type: 'image_url' as const,
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
          },
        })),
      ],
    },
  ];
};

export const runRequirementsAnalysis = async (
  input: IRequirementsAnalysisRequest,
  deps: IRequirementsAnalysisDeps
): Promise<IRequirementsAnalysisResponse> => {
  if (deps.llm.model.trim() === '') {
    deps.logger.warn('llm_model_empty', { taskId: input.taskId });
  }

  const messages = buildLlmMessages(input);

  let rawText = '';
  let attempt = 0;
  const maxAttempts = deps.llm.maxRetries + 1;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      rawText = await chatCompletionText(deps.llm, messages);
      break;
    } catch (e) {
      deps.logger.warn('llm_attempt_failed', {
        taskId: input.taskId,
        attempt,
        err: e instanceof Error ? e.message : String(e),
      });
      if (attempt >= maxAttempts) {
        throw e;
      }
    }
  }

  const parsed = stripTrailingPrdStatusLine(rawText);
  const structural = validatePrdMarkdownStructure(parsed.markdownBody);

  if (!structural.ok) {
    deps.logger.warn('prd_structure_invalid', {
      taskId: input.taskId,
      missing: structural.missing,
    });
    throw new Error(
      `模型输出缺少必选章节：${structural.missing.join('、')}。请重试或调高模型能力。`
    );
  }

  deps.logger.info('requirements_analysis_done', {
    taskId: input.taskId,
    prdStatus: parsed.prdStatus,
  });

  return {
    taskId: input.taskId,
    markdown: parsed.markdownBody,
    prdStatus: parsed.prdStatus,
  };
};
