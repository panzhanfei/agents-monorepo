/**
 * 飞书链路到终端的一行摘要（stderr），与 JSON 日志并存。
 * 设 FEISHU_FLOW_TTY=0 可关闭。
 */
export const teeFeishuFlow = (step: string, detail?: string): void => {
  if (process.env.FEISHU_FLOW_TTY === '0') {
    return;
  }
  const suffix =
    detail !== undefined && detail !== '' ? ` | ${detail}` : '';
  process.stderr.write(`[orchestrator:feishu] ${step}${suffix}\n`);
};
