import { describe, expect, it } from 'vitest';
import {
  isValidTargetStackTarget,
  type ITargetStackTarget,
} from './runtime-skills.js';

describe('runtime-skills', () => {
  it('accepts valid frontend pair', () => {
    const t: ITargetStackTarget = {
      implementationRole: 'frontend',
      stackProfile: 'nuxt-3',
    };
    expect(isValidTargetStackTarget(t)).toBe(true);
  });

  it('accepts valid backend pair', () => {
    const t: ITargetStackTarget = {
      implementationRole: 'backend',
      stackProfile: 'node-nest',
    };
    expect(isValidTargetStackTarget(t)).toBe(true);
  });

  it('rejects frontend role with backend profile', () => {
    const t: ITargetStackTarget = {
      implementationRole: 'frontend',
      stackProfile: 'node-nest',
    };
    expect(isValidTargetStackTarget(t)).toBe(false);
  });
});
