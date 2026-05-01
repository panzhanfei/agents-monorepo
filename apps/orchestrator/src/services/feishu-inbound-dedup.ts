import type { IFeishuInboundExtract } from './extract-feishu-inbound.js';

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/** 「已完成」条目过期删除，避免 Map 无限增长（单机 MVP）。 */
const DONE_RETENTION_MS = 86_400_000;
const MAX_KEYS = 10_000;

type DedupPhase = 'inflight' | 'done';

type DedupEntry = {
  readonly phase: DedupPhase;
  readonly at: number;
};

const byKey = new Map<string, DedupEntry>();

const pruneStaleDone = (now: number): void => {
  for (const [k, v] of byKey) {
    if (v.phase === 'done' && now - v.at > DONE_RETENTION_MS) {
      byKey.delete(k);
    }
  }
};

const pruneIfOverCapacity = (): void => {
  if (byKey.size <= MAX_KEYS) {
    return;
  }
  const entries = [...byKey.entries()].sort((a, b) => a[1].at - b[1].at);
  const drop = Math.max(1, Math.floor(MAX_KEYS * 0.1));
  for (const [k] of entries.slice(0, drop)) {
    byKey.delete(k);
  }
};

/**
 * 飞书同一条用户消息应对应唯一 key：优先 `message_id`，否则开放平台事件 `header.event_id`。
 * 本地扁平调试（无 id）返回 null，不做去重。
 */
export const buildFeishuDedupKey = (
  rootBody: Record<string, unknown>,
  extracted: IFeishuInboundExtract
): string | null => {
  if (
    extracted.inboundMessageId !== undefined &&
    extracted.inboundMessageId !== ''
  ) {
    return `msg:${extracted.inboundMessageId}`;
  }
  const header = asRecord(rootBody.header);
  const eventId =
    typeof header?.event_id === 'string' && header.event_id !== ''
      ? header.event_id
      : undefined;
  if (eventId !== undefined) {
    return `evt:${eventId}`;
  }
  return null;
};

/** @returns true 表示本条应继续处理；false 表示重复投递，应直接 200 且不回访飞书。 */
export const tryBeginFeishuInboundDedup = (key: string): boolean => {
  const now = Date.now();
  pruneStaleDone(now);
  pruneIfOverCapacity();

  const cur = byKey.get(key);
  if (cur?.phase === 'done' || cur?.phase === 'inflight') {
    return false;
  }
  byKey.set(key, { phase: 'inflight', at: now });
  return true;
};

export const finishFeishuInboundDedup = (
  key: string,
  success: boolean
): void => {
  const now = Date.now();
  if (success) {
    byKey.set(key, { phase: 'done', at: now });
  } else {
    byKey.delete(key);
  }
};

/** @internal 单测用 */
export const resetFeishuInboundDedupForTests = (): void => {
  byKey.clear();
};
