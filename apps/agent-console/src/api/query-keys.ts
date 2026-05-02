export const queryKeys = {
  root: ['agent-console'] as const,
  config: () => [...queryKeys.root, 'config'] as const,
  env: () => [...queryKeys.root, 'console-env'] as const,
  targetAiRules: (projectId: string) =>
    [...queryKeys.root, 'target-ai-rules', projectId] as const,
};
