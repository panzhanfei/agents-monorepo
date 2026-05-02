export const CODING_STACK_IDS = [
  'next-app-router',
  'react-vite-spa',
  'vue-vite-spa',
  'nuxt3-minimal',
  'node-esm-minimal',
  'express-typescript',
] as const;

export type ICodingScaffoldStackId = (typeof CODING_STACK_IDS)[number];

export const isCodingScaffoldStackId = (s: string): s is ICodingScaffoldStackId =>
  (CODING_STACK_IDS as readonly string[]).includes(s);

export const CODING_STACK_LABELS: Record<ICodingScaffoldStackId, string> = {
  'next-app-router': 'Next.js 15 App Router + TypeScript',
  'react-vite-spa': 'React 19 + Vite + TypeScript',
  'vue-vite-spa': 'Vue 3 + Vite + TypeScript',
  'nuxt3-minimal': 'Nuxt 3 + Vue 3',
  'node-esm-minimal': 'Node.js ESM（无框架）',
  'express-typescript': 'Express + TypeScript',
};

export const codingStackListForLlmPrompt = (): string =>
  CODING_STACK_IDS.map(
    (id) => `- "${id}": ${CODING_STACK_LABELS[id]}`
  ).join('\n');
