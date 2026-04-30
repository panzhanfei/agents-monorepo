import type { ITaskStore } from '@agents/pipeline-core';
import { MemoryTaskStore } from './memory-task-store.js';

/**
 * `TASK_STORE_DRIVER`：当前仅 `memory`。预留 `postgres`（+ Prisma）、`redis`（缓存/锁，非主存可选）。
 */
export const createTaskStore = (): ITaskStore => {
  const driver = process.env.TASK_STORE_DRIVER ?? 'memory';
  if (driver === 'memory') {
    return new MemoryTaskStore();
  }
  throw new Error(
    `TASK_STORE_DRIVER="${driver}" is not implemented yet. Use memory for MVP, or add a ${driver} adapter implementing ITaskStore.`
  );
};
