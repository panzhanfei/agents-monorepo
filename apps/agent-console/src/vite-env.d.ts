/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  /** 设为 `"1"` 时输出 `browserLogger.debug`（仅开发常用） */
  readonly VITE_CONSOLE_LOG_DEBUG?: string;
}
