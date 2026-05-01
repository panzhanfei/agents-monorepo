/** 小写归一化 UUID v4 形态（来自 taskStore） */
const UUID_CORE =
  '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

export type IRequirementsRevisionParse =
  | {
      readonly kind: 'revision';
      readonly baseTaskId: string;
      readonly instruction: string;
    }
  | { readonly kind: 'create' };

const normId = (uuid: string): string => uuid.toLowerCase();

/**
 * 从飞书正文解析「在原需求分析任务上修订 PRD」。
 * 未命中则视为新建需求分析（由调用方走 create 流程）。
 */
export const parseRequirementsAnalysisMessage = (text: string): IRequirementsRevisionParse => {
  const t = text.trim();

  let m = t.match(
    new RegExp(
      `^(?:需求分析|PRD)[\\s\\S]*?(?:修订|更新)\\s+(?:任务\\s*)?${UUID_CORE}\\s*[：:]\\s*([\\s\\S]*)$`,
      'i'
    )
  );
  if (m?.[1] !== undefined && m[2] !== undefined) {
    return {
      kind: 'revision',
      baseTaskId: normId(m[1]),
      instruction: m[2].trim(),
    };
  }

  m = t.match(
    new RegExp(
      `^(?:修订|更新)(?:\\s+PRD)?\\s+(?:任务\\s*)?${UUID_CORE}(?:\\s*[：:]\\s*([\\s\\S]*))?$`,
      'i'
    )
  );
  if (m?.[1] !== undefined) {
    const tail = typeof m[2] === 'string' ? m[2].trim() : '';
    return {
      kind: 'revision',
      baseTaskId: normId(m[1]),
      instruction: tail,
    };
  }

  m = t.match(
    new RegExp(
      `^任务\\s*ID\\s*[：:]\\s*${UUID_CORE}\\s*[。.\\s\\n]*\\s*(?:修订|更新)\\s*[：:]\\s*([\\s\\S]*)$`,
      'is'
    )
  );
  if (m?.[1] !== undefined && m[2] !== undefined) {
    return {
      kind: 'revision',
      baseTaskId: normId(m[1]),
      instruction: (m[2] ?? '').trim(),
    };
  }

  return { kind: 'create' };
};
