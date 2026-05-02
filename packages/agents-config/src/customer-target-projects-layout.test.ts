import { describe, expect, it } from 'vitest';

import {
  absoluteCustomerTargetAiRulesPath,
  relativeCustomerTargetAiRulesPath,
  relativeCustomerTargetDefinitionPath,
} from './customer-target-projects-layout.js';

describe('relativeCustomerTargetDefinitionPath', () => {
  it('returns customer-targets/<id>/target.yaml', () => {
    expect(relativeCustomerTargetDefinitionPath('my-app')).toBe(
      'customer-targets/my-app/target.yaml',
    );
  });
});

describe('relativeCustomerTargetAiRulesPath', () => {
  it('returns customer-targets/<id>/ai-rules', () => {
    expect(relativeCustomerTargetAiRulesPath('my-app')).toBe(
      'customer-targets/my-app/ai-rules',
    );
  });
});

describe('absoluteCustomerTargetAiRulesPath', () => {
  it('joins monorepo root', () => {
    expect(
      absoluteCustomerTargetAiRulesPath('/repo/root', 'svc-a').replace(/\\/g, '/'),
    ).toBe('/repo/root/customer-targets/svc-a/ai-rules');
  });
});
