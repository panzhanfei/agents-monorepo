/**
 * 飞书文本里常见 @人 / @机器人 / `<at>` 标签，去掉后便于意图识别（如「@流水线 你好」→「你好」）。
 */
export const normalizeFeishuPlainText = (raw: string): string => {
  let s = raw.replace(/\u200B/g, '').trim();
  s = s.replace(/<at\s+[^>]*>[\s\S]*?<\/at>/gi, ' ');
  s = s.replace(/@_user_\w+/gi, ' ');
  s = s.replace(/@[\p{L}\p{N}_-]+/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
};
