import type { ITaskStore } from '@agents/pipeline-core';

/** UUID v4 样式（任务 id）；大小写不敏感，输出以小写去重保序。 */
const TASK_UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export const extractTaskUuidCandidatesFromText = (text: string): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(TASK_UUID_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const canonical = m[0].toLowerCase();
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
};

const buildPrdAppendix = (markdown: string): string =>
  [
    '',
    '',
    '---',
    '',
    '## 关联需求文档（PRD）',
    '',
    markdown.trimEnd(),
    '',
  ].join('\n');

const tryLoadRequirementsMarkdown = async (
  store: ITaskStore,
  taskId: string
): Promise<string | null> => {
  const task = await store.getTask(taskId);
  if (task === null) {
    return null;
  }
  const mdUnknown = task.metadata?.requirementsMarkdown;
  const md = typeof mdUnknown === 'string' ? mdUnknown.trim() : '';
  if (md === '') {
    return null;
  }
  if (
    task.action !== undefined &&
    task.action !== '' &&
    task.action !== 'requirements_analysis'
  ) {
    return null;
  }
  return md;
};

/**
 * 将当前会话正文与任务存储里的 PRD（引用线程锚点或正文中的需求任务 UUID）合并，供 coding-agent 选型与落盘。
 */
export const mergeRequirementsMarkdownIntoCodingInstruction = async (opts: {
  readonly instructionBody: string;
  readonly taskStore: ITaskStore;
  readonly quotedThreadTaskId?: string;
}): Promise<string> => {
  const base = opts.instructionBody.trimEnd();

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const pushId = (raw: string | undefined): void => {
    if (raw === undefined || raw.trim() === '') {
      return;
    }
    const id = raw.trim().toLowerCase();
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    orderedIds.push(id);
  };

  pushId(opts.quotedThreadTaskId);
  for (const u of extractTaskUuidCandidatesFromText(opts.instructionBody)) {
    pushId(u);
  }

  for (const tid of orderedIds) {
    const md = await tryLoadRequirementsMarkdown(opts.taskStore, tid);
    if (md !== null) {
      return `${base}${buildPrdAppendix(md)}`;
    }
  }

  return base;
};
