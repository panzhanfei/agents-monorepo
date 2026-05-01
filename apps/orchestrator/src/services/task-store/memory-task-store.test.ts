import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryTaskStore } from './memory-task-store.js';

describe('MemoryTaskStore', () => {
  let store: MemoryTaskStore;

  beforeEach(() => {
    store = new MemoryTaskStore();
  });

  it('creates and retrieves task', async () => {
    const t = await store.createTask({ action: 'test', message: 'm' });
    expect(t.taskId).toBeDefined();
    expect(t.status).toBe('pending');
    const got = await store.getTask(t.taskId);
    expect(got?.action).toBe('test');
  });

  it('updates task', async () => {
    const t = await store.createTask({});
    const u = await store.updateTask(t.taskId, { status: 'running' });
    expect(u?.status).toBe('running');
  });

  it('findActiveTaskByAction respects action', async () => {
    await store.createTask({ action: 'code', message: 'first' });
    const hit = await store.findActiveTaskByAction({ action: 'code' });
    expect(hit?.message).toBe('first');
    const miss = await store.findActiveTaskByAction({
      action: 'requirements_analysis',
    });
    expect(miss).toBeNull();
  });

  it('findActiveTaskByAction filters by channelId', async () => {
    await store.createTask({
      action: 'code',
      message: 'a',
      metadata: { channelId: 'G1' },
    });
    const g1 = await store.findActiveTaskByAction({
      action: 'code',
      channelId: 'G1',
    });
    expect(g1?.message).toBe('a');
    const g2 = await store.findActiveTaskByAction({
      action: 'code',
      channelId: 'G2',
    });
    expect(g2).toBeNull();
  });

  it('completed task does not block', async () => {
    const t = await store.createTask({ action: 'code' });
    await store.updateTask(t.taskId, { status: 'completed' });
    const hit = await store.findActiveTaskByAction({ action: 'code' });
    expect(hit).toBeNull();
  });

  it('clearAllTasks wipes all rows', async () => {
    await store.createTask({ action: 'a' });
    await store.createTask({ action: 'b' });
    const n = await store.clearAllTasks();
    expect(n).toBe(2);
    const list = await store.listTasks();
    expect(list).toHaveLength(0);
  });
});
