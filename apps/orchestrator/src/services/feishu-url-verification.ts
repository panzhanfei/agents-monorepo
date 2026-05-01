/**
 * 飞书事件订阅：保存「请求地址」时 POST `url_verification`，需在 JSON 中返回相同 `challenge`。
 * @see https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM
 */
export const extractFeishuUrlVerificationChallenge = (
  body: unknown
): string | null => {
  if (body === null || typeof body !== 'object') {
    return null;
  }
  const root = body as Record<string, unknown>;
  if (
    root.type === 'url_verification' &&
    typeof root.challenge === 'string' &&
    root.challenge.length > 0
  ) {
    return root.challenge;
  }
  const ev = root.event;
  if (ev !== null && typeof ev === 'object') {
    const e = ev as Record<string, unknown>;
    if (
      e.type === 'url_verification' &&
      typeof e.challenge === 'string' &&
      e.challenge.length > 0
    ) {
      return e.challenge;
    }
  }
  return null;
};
