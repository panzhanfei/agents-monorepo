import { describe, expect, it } from 'vitest';
import { stripOptionalRequirementsPrefix } from './strip-requirements-lead.js';

describe('stripOptionalRequirementsPrefix', () => {
  it('strips leading demand prefix', () => {
    expect(stripOptionalRequirementsPrefix('需求分析：只要 SSG')).toBe('只要 SSG');
    expect(stripOptionalRequirementsPrefix('  需求分析 ：  只要 SSG  ')).toBe(
      '只要 SSG'
    );
  });

  it('leaves unrelated text', () => {
    expect(stripOptionalRequirementsPrefix('只要 SSG')).toBe('只要 SSG');
  });
});
