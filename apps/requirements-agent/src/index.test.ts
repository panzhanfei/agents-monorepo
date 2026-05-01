import { describe, expect, it } from 'vitest';
import {
  stripTrailingPrdStatusLine,
  validatePrdMarkdownStructure,
} from './services/markdown-structure.js';

const samplePrd = [
  '## 概述',
  '',
  '简述。',
  '',
  '## 用户故事 / 功能列表',
  '',
  '- US1',
  '',
  '## 验收标准（AC）',
  '',
  '- AC-1 …',
  '',
  '## 非功能约束',
  '',
  '- NFR …',
  '',
  '## 边界与异常',
  '',
  '- …',
  '',
  '## 依赖与假设',
  '',
  '- …',
  '',
  '## 风险与待确认项',
  '',
  '- …',
  '',
  'PRD_STATUS: draft',
].join('\n');

describe('requirements-agent markdown-structure', () => {
  it('strips trailing PRD_STATUS line', () => {
    const p = stripTrailingPrdStatusLine(samplePrd);
    expect(p.prdStatus).toBe('draft');
    expect(p.markdownBody.includes('PRD_STATUS')).toBe(false);
  });

  it('validates required sections', () => {
    const p = stripTrailingPrdStatusLine(samplePrd);
    expect(validatePrdMarkdownStructure(p.markdownBody)).toEqual({ ok: true });
  });

  it('detects missing sections', () => {
    const bad = stripTrailingPrdStatusLine('## 概述\n\n仅概述\n\nPRD_STATUS: draft');
    expect(validatePrdMarkdownStructure(bad.markdownBody).ok).toBe(false);
  });
});
