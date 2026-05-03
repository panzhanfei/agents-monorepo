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

const metaFeishuChannelId = (
  metadata: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  if (metadata === undefined) {
    return undefined;
  }
  const c = metadata.channelId ?? metadata.feishu_chat_id;
  return typeof c === 'string' && c.trim() !== '' ? c.trim() : undefined;
};

/** 在已完成的需求分析任务中选 `updatedAt` 最新的一条（时间戳相同则按 taskId 打破平局）。 */
const pickLatestCompletedRequirementsMarkdown = async (
  store: ITaskStore,
  predicate: (task: {
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) => boolean
): Promise<string | null> => {
  const tasks = await store.listTasks({ limit: 120 });
  const hits = tasks.filter((t) => {
    if (t.action !== 'requirements_analysis' || t.status !== 'completed') {
      return false;
    }
    const mdUnknown = t.metadata?.requirementsMarkdown;
    const md = typeof mdUnknown === 'string' ? mdUnknown.trim() : '';
    if (md === '') {
      return false;
    }
    return predicate(t);
  });
  if (hits.length === 0) {
    return null;
  }
  hits.sort((a, b) => {
    const dt =
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (dt !== 0) {
      return dt;
    }
    const ct =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (ct !== 0) {
      return ct;
    }
    return b.taskId.localeCompare(a.taskId);
  });
  const top = hits[0];
  const mdUnknown = top?.metadata?.requirementsMarkdown;
  const md = typeof mdUnknown === 'string' ? mdUnknown.trim() : '';
  return md !== '' ? md : null;
};

/**
 * 将当前会话正文与任务存储里的 PRD（引用线程锚点或正文中的需求任务 UUID）合并，供 coding-agent 选型与落盘。
 *
 * 解析顺序：引用锚点任务 id → 正文中的需求任务 UUID → **同会话最近一次已完成的需求分析**（`channelId`）
 * → **同一目标项目 id 最近一次已完成的需求分析**（Console / 单通道无引用时的兜底）。
 */
export const mergeRequirementsMarkdownIntoCodingInstruction = async (opts: {
  readonly instructionBody: string;
  readonly taskStore: ITaskStore;
  readonly quotedThreadTaskId?: string;
  readonly channelId?: string;
  readonly customerTargetProjectId?: string;
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

  const channelTrimmed = opts.channelId?.trim() ?? '';
  if (channelTrimmed !== '') {
    const byChannel = await pickLatestCompletedRequirementsMarkdown(
      opts.taskStore,
      (t) => metaFeishuChannelId(t.metadata) === channelTrimmed
    );
    if (byChannel !== null) {
      return `${base}${buildPrdAppendix(byChannel)}`;
    }
  }

  const targetTrimmed = opts.customerTargetProjectId?.trim() ?? '';
  if (targetTrimmed !== '') {
    const byTarget = await pickLatestCompletedRequirementsMarkdown(
      opts.taskStore,
      (t) => {
        const p =
          typeof t.metadata?.targetProjectId === 'string'
            ? t.metadata.targetProjectId.trim()
            : '';
        return p !== '' && p === targetTrimmed;
      }
    );
    if (byTarget !== null) {
      return `${base}${buildPrdAppendix(byTarget)}`;
    }
  }

  return base;
};
