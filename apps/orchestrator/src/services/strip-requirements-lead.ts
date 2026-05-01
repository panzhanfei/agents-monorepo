/** 引用回复时去掉行首「需求分析：」等例行前缀。 */
export const stripOptionalRequirementsPrefix = (text: string): string =>
  text.trim().replace(/^需求分析\s*[：:]\s*/i, '').trim();
