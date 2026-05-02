import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type IConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 页面侧持久化偏好（打字速度、本地化文案 key→文案） */
export type IConsolePersistedPreferences = {
  /** 逐字显示间隔，毫秒 */
  readonly typewriterDelayMs: number;
  /**
   * UI 文案本地化映射：key 为稳定英文/点号路径，value 为展示用文本
   * 例：`{ "logPanel.title": "运行日志流" }`
   */
  readonly localeMap: Record<string, string>;
};

export type IConsoleLogLine = {
  readonly id: string;
  readonly ts: number;
  readonly level: IConsoleLogLevel;
  /** 单行完整文本（渲染时由子组件做逐字显现） */
  readonly fullText: string;
};

const DEFAULT_PREFS: IConsolePersistedPreferences = {
  typewriterDelayMs: 22,
  localeMap: {
    'logPanel.title': '运行日志流',
    'logPanel.clear': '清空',
    'logPanel.delayLabel': '打字(ms/字)',
    'logPanel.delayHint': '越低越快；偏好会写入本地',
  },
};

const MAX_LOG_LINES = 220;

const formatAppendPayload = (
  msg: string,
  meta?: Record<string, unknown>
): string => {
  if (meta === undefined || Object.keys(meta).length === 0) {
    return msg;
  }

  try {
    return `${msg} ${JSON.stringify(meta)}`;
  } catch {
    return `${msg}`;
  }
};

interface IConsoleStoreShape {
  readonly preferences: IConsolePersistedPreferences;

  /** 仅内存保留，避免刷新后暴涨 localStorage */
  readonly logLines: readonly IConsoleLogLine[];

  appendLog: (
    level: IConsoleLogLevel,
    msg: string,
    meta?: Record<string, unknown>
  ) => void;

  clearLogs: () => void;

  setTypewriterDelayMs: (ms: number) => void;

  /** 更新或新增一条本地化条目 */
  setLocaleEntry: (key: string, label: string) => void;

  /** 读取本地化字符串，缺省时用 fallback */
  localeText: (key: string, fallback?: string) => string;
}

export const useConsoleStore = create<IConsoleStoreShape>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFS,

      logLines: [],

      appendLog: (level, msg, meta): void => {
        const body = formatAppendPayload(msg, meta);

        const fullText = `[${level}] ${body}`;

        const line: IConsoleLogLine = {
          id:
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `l-${String(Date.now())}-${String(Math.random()).slice(2, 9)}`,

          ts: Date.now(),

          level,

          fullText,
        };

        set((s) => ({
          logLines: [...s.logLines, line].slice(-MAX_LOG_LINES),
        }));
      },

      clearLogs: (): void => {
        set({ logLines: [] });
      },

      setTypewriterDelayMs: (ms: number): void => {
        const n = Number.isFinite(ms)
          ? Math.min(120, Math.max(4, Math.round(ms)))
          : 22;

        set((s) => ({
          preferences: { ...s.preferences, typewriterDelayMs: n },
        }));
      },

      setLocaleEntry: (key: string, label: string): void => {
        const k = key.trim();
        if (k === '') {
          return;
        }

        set((s) => ({
          preferences: {
            ...s.preferences,
            localeMap: { ...s.preferences.localeMap, [k]: label },
          },
        }));
      },

      localeText: (key: string, fallback?: string): string => {
        const map = get().preferences.localeMap;
        const v = map[key];

        return v !== undefined && v !== '' ? v : (fallback ?? key);
      },
    }),
    {
      name: 'agent-console-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: IConsoleStoreShape) => ({
        preferences: state.preferences,
      }),
    }
  )
);

/** 供非 React 模块（如 browser-logger）同步追加 */
export const appendConsoleLog = (
  level: IConsoleLogLevel,
  msg: string,
  meta?: Record<string, unknown>
): void => {
  useConsoleStore.getState().appendLog(level, msg, meta);
};
