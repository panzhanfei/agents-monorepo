import { useEffect, useRef } from 'react';

import type { IConsoleLogLevel } from '~/stores/console-store';
import { appendConsoleLog } from '~/stores/console-store';

const parseLevel = (raw: unknown): IConsoleLogLevel | null => {
  if (
    raw === 'debug' ||
    raw === 'info' ||
    raw === 'warn' ||
    raw === 'error'
  ) {
    return raw;
  }

  return null;
};

/**
 * 订阅编排器 `/v1/console/feishu-log-stream`（经本机 `/api/feishu-log-stream` 代理），
 * 将飞书链路摘要写入「运行日志流」。
 */
export const useFeishuRuntimeLogStream = (): void => {
  const openAnnouncedRef = useRef(false);
  const errorAnnouncedRef = useRef(false);

  useEffect(() => {
    const es = new EventSource('/api/feishu-log-stream');

    es.onopen = (): void => {
      if (openAnnouncedRef.current === true) {
        return;
      }
      openAnnouncedRef.current = true;
      appendConsoleLog('info', '已连接飞书消息日志流（编排器 SSE）');
    };

    es.onmessage = (ev: MessageEvent<string>): void => {
      try {
        const j = JSON.parse(ev.data) as { level?: unknown; msg?: unknown };

        const msg = typeof j.msg === 'string' ? j.msg : null;
        const level = parseLevel(j.level);

        if (msg !== null && level !== null) {
          appendConsoleLog(level, msg);
        }
      } catch {
        /* ignore malformed SSE */
      }
    };

    es.onerror = (): void => {
      if (errorAnnouncedRef.current === true) {
        return;
      }
      errorAnnouncedRef.current = true;
      appendConsoleLog(
        'warn',
        '飞书日志流暂不可用（请确认编排器已启动，且 ORCHESTRATOR_PORT / AGENTS_ORCHESTRATOR_URL 与控制台 API 一致）'
      );
    };

    return (): void => {
      es.close();
    };
  }, []);
};
