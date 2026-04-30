import { randomUUID } from 'node:crypto';
import type {
  ICreateTaskInput,
  IFindActiveTaskQuery,
  ITaskRecord,
  ITaskStore,
  IUpdateTaskPatch,
  TaskStatus,
} from '@agents/pipeline-core';
import { isActiveTaskStatus } from '@agents/pipeline-core';

const nowIso = (): string => new Date().toISOString();

const metaChannelId = (
  metadata: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  if (metadata === undefined) {
    return undefined;
  }
  const c = metadata.channelId ?? metadata.feishu_chat_id;
  return typeof c === 'string' && c !== '' ? c : undefined;
};

/**
 * 进程内任务存储；单机 MVP。替换为 Prisma + Postgres 时保持 {@link ITaskStore} 不变。
 */
export class MemoryTaskStore implements ITaskStore {
  private readonly byId = new Map<string, ITaskRecord>();

  public async createTask(input: ICreateTaskInput): Promise<ITaskRecord> {
    const ts = nowIso();
    const rec: ITaskRecord = {
      taskId: randomUUID(),
      status: 'pending',
      action: input.action,
      message: input.message,
      metadata: input.metadata ? { ...input.metadata } : undefined,
      createdAt: ts,
      updatedAt: ts,
    };
    this.byId.set(rec.taskId, rec);
    return rec;
  }

  public async getTask(taskId: string): Promise<ITaskRecord | null> {
    const hit = this.byId.get(taskId);
    return hit ?? null;
  }

  public async updateTask(
    taskId: string,
    patch: IUpdateTaskPatch
  ): Promise<ITaskRecord | null> {
    const prev = this.byId.get(taskId);
    if (prev === undefined) {
      return null;
    }
    const nextMeta =
      patch.metadata !== undefined
        ? { ...prev.metadata, ...patch.metadata }
        : prev.metadata;
    const next: ITaskRecord = {
      taskId: prev.taskId,
      status: (patch.status ?? prev.status) as TaskStatus,
      action: patch.action ?? prev.action,
      message: patch.message ?? prev.message,
      metadata: nextMeta,
      createdAt: prev.createdAt,
      updatedAt: nowIso(),
    };
    this.byId.set(taskId, next);
    return next;
  }

  public async listTasks(options?: {
    limit?: number;
  }): Promise<ITaskRecord[]> {
    const lim = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    return [...this.byId.values()]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, lim);
  }

  public async findActiveTaskByAction(
    query: IFindActiveTaskQuery
  ): Promise<ITaskRecord | null> {
    const wantChannel = query.channelId;
    for (const t of this.byId.values()) {
      if (!isActiveTaskStatus(t.status)) {
        continue;
      }
      if (t.action !== query.action) {
        continue;
      }
      if (wantChannel !== undefined && wantChannel !== '') {
        const ch = metaChannelId(t.metadata);
        if (ch !== wantChannel) {
          continue;
        }
      }
      return t;
    }
    return null;
  }
}
