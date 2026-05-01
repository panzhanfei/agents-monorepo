import type { RequirementsPrdStatus } from '@agents/pipeline-core';

/** 必选二级标题（模型可按提示写「验收标准（AC）」等变体，正则兼容）。 */
const REQUIRED_SECTIONS: readonly { readonly label: string; readonly pattern: RegExp }[] =
  [
    { label: '概述', pattern: /^##\s*概述(?:\s|$)/m },
    {
      label: '用户故事 / 功能列表',
      pattern: /^##\s*用户故事/m,
    },
    {
      label: '验收标准',
      pattern: /^##\s*验收标准/m,
    },
    { label: '非功能约束', pattern: /^##\s*非功能约束(?:\s|$)/m },
    { label: '边界与异常', pattern: /^##\s*边界与异常(?:\s|$)/m },
    { label: '依赖与假设', pattern: /^##\s*依赖与假设(?:\s|$)/m },
    {
      label: '风险与待确认项',
      pattern: /^##\s*风险与待确认项(?:\s|$)/m,
    },
  ];

export type IParsedPrdMarkdown = {
  readonly markdownBody: string;
  readonly prdStatus: RequirementsPrdStatus;
};

export const stripTrailingPrdStatusLine = (
  raw: string
): IParsedPrdMarkdown => {
  const lines = raw.trimEnd().split('\n');
  const lastLine = lines[lines.length - 1]?.trim() ?? '';
  const m =
    /^PRD_STATUS:\s*(draft|ready_for_implementation)\s*$/i.exec(lastLine);
  if (m !== null) {
    lines.pop();
    const flag = (m[1] ?? 'draft').toLowerCase();
    const prdStatus: RequirementsPrdStatus =
      flag === 'ready_for_implementation'
        ? 'ready_for_implementation'
        : 'draft';
    return { markdownBody: lines.join('\n').trimEnd(), prdStatus };
  }
  return { markdownBody: raw.trimEnd(), prdStatus: 'draft' };
};

export const validatePrdMarkdownStructure = (
  markdownBody: string
): { ok: true } | { ok: false; missing: string[] } => {
  const missing = REQUIRED_SECTIONS.filter(
    (s) => !s.pattern.test(markdownBody)
  ).map((s) => s.label);
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true };
};
