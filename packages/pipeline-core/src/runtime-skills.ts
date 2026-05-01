/**
 * 运行时 Skill v1：脱离编辑器的编排载荷（单一事实来源）。
 * 对齐 docs/ARCHITECTURE.md §15。
 */

export type ImplementationRole = 'frontend' | 'backend' | 'fullstack';

export type FrontendStackProfile =
  | 'next-app-router'
  | 'next-pages'
  | 'react-spa'
  | 'vue-spa-vite'
  | 'nuxt-3';

export type BackendStackProfile =
  | 'node-nest'
  | 'node-express-fastify'
  | 'go-gin';

export type StackProfile = FrontendStackProfile | BackendStackProfile;

/** 与 ARCHITECTURE §15.4 对齐；供 Zod / 校验共用，避免字面量漂移 */
export const FRONTEND_STACK_PROFILES = [
  'next-app-router',
  'next-pages',
  'react-spa',
  'vue-spa-vite',
  'nuxt-3',
] as const satisfies readonly FrontendStackProfile[];

export const BACKEND_STACK_PROFILES = [
  'node-nest',
  'node-express-fastify',
  'go-gin',
] as const satisfies readonly BackendStackProfile[];

/** v1：每条为单一实现面；fullstack 由多条 target 表达 */
export interface ITargetStackTarget {
  readonly implementationRole: 'frontend' | 'backend';
  readonly stackProfile: StackProfile;
}

export const isFrontendStackProfile = (
  p: string
): p is FrontendStackProfile =>
  (FRONTEND_STACK_PROFILES as readonly string[]).includes(p);

export const isBackendStackProfile = (p: string): p is BackendStackProfile =>
  (BACKEND_STACK_PROFILES as readonly string[]).includes(p);

export const isValidTargetStackTarget = (t: ITargetStackTarget): boolean => {
  if (t.implementationRole === 'frontend') {
    return isFrontendStackProfile(t.stackProfile);
  }
  if (t.implementationRole === 'backend') {
    return isBackendStackProfile(t.stackProfile);
  }
  return false;
};
