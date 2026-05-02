export const queryKeys = {
  root: ['agent-console'] as const,
  config: () => [...queryKeys.root, 'config'] as const,
};
