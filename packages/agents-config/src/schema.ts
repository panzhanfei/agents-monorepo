import { z } from 'zod';

const reviewProfileSchema = z
  .object({
    aiRulesGlob: z.string(),
    customerRulesDir: z.string(),
    blockingCommands: z.array(z.string()),
  })
  .passthrough();

export const agentsConfigSchema = z
  .object({
    pipeline: z
      .object({
        fullTestCommand: z.string(),
      })
      .passthrough(),
    review: z
      .object({
        activeProfile: z.string(),
        profiles: z.record(z.string(), reviewProfileSchema),
        extraConfigFiles: z.array(z.string()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type IAgentsConfig = z.infer<typeof agentsConfigSchema>;
