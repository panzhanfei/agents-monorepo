export type IFeishuConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type IFeishuConsolePayload = {
  readonly level: IFeishuConsoleLogLevel;
  readonly msg: string;
};

const listeners = new Set<(p: IFeishuConsolePayload) => void>();

/** 仅单测重置 */
export const resetFeishuConsoleBroadcastForTests = (): void => {
  listeners.clear();
};

export const subscribeFeishuConsole = (
  fn: (p: IFeishuConsolePayload) => void
): (() => void) => {
  listeners.add(fn);

  return (): void => {
    listeners.delete(fn);
  };
};

export const broadcastFeishuConsole = (p: IFeishuConsolePayload): void => {
  for (const fn of listeners) {
    try {
      fn(p);
    } catch {
      /* ignore subscriber errors */
    }
  }
};
