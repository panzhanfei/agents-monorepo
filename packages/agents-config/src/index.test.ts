import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from './resolve-workspace-path.js';

describe('agents-config paths', () => {
  it('resolves relative workspace against monorepo root', () => {
    const root = '/repo';
    expect(resolveWorkspacePath(root, './workspace/foo')).toBe(
      path.resolve(root, 'workspace/foo')
    );
  });

  it('keeps absolute workspace path', () => {
    expect(resolveWorkspacePath('/repo', '/abs/proj')).toBe('/abs/proj');
  });
});
