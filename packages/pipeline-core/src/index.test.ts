import { describe, expect, it } from 'vitest';
import { PIPELINE_CORE_SCAFFOLD } from './index';

describe('pipeline-core', () => {
  it('exports scaffold marker', () => {
    expect(PIPELINE_CORE_SCAFFOLD).toBe('0.0.0-scaffold');
  });
});
