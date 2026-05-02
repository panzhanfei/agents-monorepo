import { appendConsoleLog } from '~/stores/console-store';

/** 浏览器端结构化日志前缀；避免与 @agents/logger（Node/fs）耦合。 */

export type ILogMeta = Record<string, unknown>;

const scope = '[agent-console]';

const shouldDebug = (): boolean => {
  if (import.meta.env.DEV !== true) {
    return false;
  }
  return import.meta.env.VITE_CONSOLE_LOG_DEBUG === '1';
};

export const browserLogger = {
  debug: (msg: string, meta?: ILogMeta): void => {
    if (shouldDebug() !== true) {
      return;
    }
    if (meta !== undefined) {
      console.debug(scope, msg, meta);
    } else {
      console.debug(scope, msg);
    }
    appendConsoleLog('debug', msg, meta);
  },

  info: (msg: string, meta?: ILogMeta): void => {
    if (meta !== undefined) {
      console.info(scope, msg, meta);
    } else {
      console.info(scope, msg);
    }

    appendConsoleLog('info', msg, meta);
  },

  warn: (msg: string, meta?: ILogMeta): void => {
    if (meta !== undefined) {
      console.warn(scope, msg, meta);
    } else {
      console.warn(scope, msg);
    }

    appendConsoleLog('warn', msg, meta);
  },

  error: (msg: string, meta?: ILogMeta): void => {
    if (meta !== undefined) {
      console.error(scope, msg, meta);
    } else {
      console.error(scope, msg);
    }

    appendConsoleLog('error', msg, meta);
  },
};
