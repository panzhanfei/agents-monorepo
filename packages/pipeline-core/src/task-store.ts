/**
 * 任务持久化契约：MVP 用内存实现；后续可换 PostgreSQL / Redis 等，不修改路由与服务签名。
 * 向量检索（pgvector）等挂在独立模块，与 TaskStore 正交。
 */

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_confirmation';

export interface ITaskRecord {
  readonly taskId: string;
  readonly status: TaskStatus;
  /** 与 FEISHU_COMMANDS / 路由一致的内部动作名，如 requirements_analysis */
  readonly action?: string;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ICreateTaskInput = {
  action?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type IUpdateTaskPatch = Partial<{
  status: TaskStatus;
  action: string;
  message: string;
  metadata: Record<string, unknown>;
}>;

/** 判定为「进行中」的状态（与 completed/failed 互斥，用于并发门禁）。 */
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'running',
  'awaiting_confirmation',
];

export const isActiveTaskStatus = (s: TaskStatus): boolean =>
  ACTIVE_TASK_STATUSES.includes(s);

/** 按动作（及可选飞书会话）查找是否已有进行中的任务。 */
export type IFindActiveTaskQuery = {
  action: string;
  /** 与写入 `metadata.channelId` 一致；缺省则仅按 action 全局互斥（单机 MVP）。 */
  channelId?: string;
};

export interface ITaskStore {
  createTask(input: ICreateTaskInput): Promise<ITaskRecord>;
  getTask(taskId: string): Promise<ITaskRecord | null>;
  updateTask(
    taskId: string,
    patch: IUpdateTaskPatch
  ): Promise<ITaskRecord | null>;
  listTasks(options?: { limit?: number }): Promise<ITaskRecord[]>;
  /**
   * 是否存在同 action（及可选同 channel）的进行中任务。
   * 后续 PostgreSQL 实现可用唯一部分索引 `(action, channel_id) WHERE status IN (...)` 优化。
   */
  findActiveTaskByAction(query: IFindActiveTaskQuery): Promise<ITaskRecord | null>;
  /**
   * 删除全部任务记录（仅适用于 memory 等可丢弃存储；持久化实现可抛错或对接运维级 purge）。
   * @returns 删除条数
   */
  clearAllTasks(): Promise<number>;
}
