/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选；填写且非空时优先于 `VITE_API_BASE`（指向线上/预发 API）。 */
  readonly VITE_API_BASE_ONLINE?: string;
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
