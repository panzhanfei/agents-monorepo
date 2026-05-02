import { describe, expect, it } from 'vitest';
import {
  broadcastFeishuConsole,
  resetFeishuConsoleBroadcastForTests,
  subscribeFeishuConsole,
} from './feishu-console-broadcast.js';

describe('feishu-console-broadcast', () => {
  it('delivers payloads to subscribers and supports unsubscribe', () => {
    resetFeishuConsoleBroadcastForTests();
    const seen: string[] = [];

    const off = subscribeFeishuConsole((p) => {
      seen.push(`${p.level}:${p.msg}`);
    });

    broadcastFeishuConsole({ level: 'info', msg: 'a' });
    expect(seen).toEqual(['info:a']);

    off();
    broadcastFeishuConsole({ level: 'warn', msg: 'b' });
    expect(seen).toEqual(['info:a']);
  });
});
