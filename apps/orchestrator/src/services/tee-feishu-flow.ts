import { broadcastFeishuConsole } from './feishu-console-broadcast.js';

/**
 * 飞书链路到终端的一行摘要（stderr），与 JSON 日志并存。
 * 设 FEISHU_FLOW_TTY=0 可关闭 stderr；Agent Console SSE 仍会收到同一摘要。
 */
export const teeFeishuFlow = (step: string, detail?: string): void => {
  const suffix =
    detail !== undefined && detail !== '' ? ` | ${detail}` : '';
  const line = `[orchestrator:feishu] ${step}${suffix}`;

  broadcastFeishuConsole({ level: 'info', msg: line });

  if (process.env.FEISHU_FLOW_TTY === '0') {
    return;
  }

  process.stderr.write(`${line}\n`);
};
