import type { RequestHandler } from 'express';
import { AppError } from '@agents/http-errors';
import type { ILogger } from '@agents/logger';
import {
  BACKEND_STACK_PROFILES,
  FRONTEND_STACK_PROFILES,
} from '@agents/pipeline-core';
import { z } from 'zod';
import { getLlmEnvConfig } from '../config/env.js';
import { LlmTransportError } from '../clients/llm-openai-compatible.js';
import { runRequirementsAnalysis } from '../services/requirements-analysis-service.js';

const targetSchema = z.discriminatedUnion('implementationRole', [
  z.object({
    implementationRole: z.literal('frontend'),
    stackProfile: z.enum(FRONTEND_STACK_PROFILES),
  }),
  z.object({
    implementationRole: z.literal('backend'),
    stackProfile: z.enum(BACKEND_STACK_PROFILES),
  }),
]);

export const requirementsAnalysisBodySchema = z
  .object({
    taskId: z.string().min(1),
    mode: z.enum(['create', 'revise']).optional(),
    priorPrdMarkdown: z.string().max(600_000).optional(),
    rawRequirement: z.string().min(1).max(500_000),
    imageAttachments: z
      .array(
        z.object({
          mimeType: z.string().min(3).max(80),
          base64: z.string().min(8).max(3_500_000),
        })
      )
      .max(6)
      .optional(),
    targetStackTargets: z.array(targetSchema).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'revise') {
      if (v.priorPrdMarkdown === undefined || v.priorPrdMarkdown.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'revise 模式必须提供非空的 priorPrdMarkdown',
          path: ['priorPrdMarkdown'],
        });
      }
    }
    const allowMime = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
    ]);
    const imgs = v.imageAttachments;
    if (imgs !== undefined) {
      imgs.forEach((im, i) => {
        if (!allowMime.has(im.mimeType.trim().toLowerCase())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `不支持的图片 MIME：${im.mimeType}`,
            path: ['imageAttachments', i, 'mimeType'],
          });
        }
      });
    }
  });

export const createRequirementsAnalyzeHandler = (
  logger: ILogger
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const parsed = requirementsAnalysisBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new AppError('BAD_REQUEST', detail || 'Invalid body', 400);
      }

      const llm = getLlmEnvConfig();
      const result = await runRequirementsAnalysis(parsed.data, {
        logger,
        llm,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof AppError) {
        next(e);
        return;
      }
      if (e instanceof LlmTransportError) {
        const sc = e.statusCode;
        const status =
          sc !== undefined && sc >= 400 && sc < 600 ? sc : 502;
        next(new AppError('LLM_UPSTREAM', e.message, status));
        return;
      }
      if (
        e instanceof Error &&
        e.message.includes('缺少必选章节')
      ) {
        next(new AppError('PRD_STRUCTURE_INVALID', e.message, 422));
        return;
      }
      next(e);
    }
  };
};
