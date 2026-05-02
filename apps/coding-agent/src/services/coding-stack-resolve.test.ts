import { describe, expect, it } from 'vitest';

import { resolveStackHeuristic } from './coding-stack-resolve.js';

describe('resolveStackHeuristic', () => {
  it('detects Next.js', () => {
    expect(resolveStackHeuristic('公司官网用 Next.js App Router')?.stack).toBe(
      'next-app-router'
    );
    expect(resolveStackHeuristic('采用next技术栈')?.stack).toBe('next-app-router');
    expect(resolveStackHeuristic('采用 next 技术栈')?.stack).toBe('next-app-router');
    expect(resolveStackHeuristic('使用 Next.js 构建静态站点')?.stack).toBe(
      'next-app-router'
    );
  });

  it('detects Vue + Vite', () => {
    expect(resolveStackHeuristic('后台管理 Vue3 + Vite')?.stack).toBe(
      'vue-vite-spa'
    );
  });

  it('returns undefined for vague text', () => {
    expect(resolveStackHeuristic('随便做点功能')).toBeUndefined();
  });
});
