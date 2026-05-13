import type { IApiErrorBody, IFetchJsonOptions } from "./interface";
import {
  clearAllStoredAuth,
  readStoredRefresh,
  writeStoredRefresh,
  writeStoredToken,
} from "@/auth/tokenStorage";

const trimApiBase = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** 线上优先：已配置 `VITE_API_BASE_ONLINE` 时用线上根地址，否则 `VITE_API_BASE`，再否则本地默认。 */
const envBase = (): string => {
  const online = trimApiBase(import.meta.env.VITE_API_BASE_ONLINE);
  if (online) return online;
  const fallback = trimApiBase(import.meta.env.VITE_API_BASE);
  if (fallback) return fallback;
  return "http://127.0.0.1:3000";
};

export const getApiBase = (): string => envBase();

let accessToken: string | null = null;

export const apiSetAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: IApiErrorBody | null;

  constructor(status: number, message: string, body: IApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

const refreshAccessSession = async (): Promise<boolean> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  const storedRefresh = readStoredRefresh();
  if (!storedRefresh) {
    return false;
  }

  const run = async (): Promise<boolean> => {
    try {
      const url = `${envBase()}/auth/refresh`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      const parsed = (await res.json().catch(() => null)) as
        | { accessToken?: unknown; refreshToken?: unknown }
        | null;
      if (!res.ok || !parsed || typeof parsed !== "object") {
        return false;
      }
      const nextAccess = parsed.accessToken;
      const nextRefresh = parsed.refreshToken;
      if (typeof nextAccess !== "string" || typeof nextRefresh !== "string") {
        return false;
      }
      writeStoredToken(nextAccess);
      writeStoredRefresh(nextRefresh);
      apiSetAccessToken(nextAccess);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  };

  refreshInFlight = run();
  return refreshInFlight;
};

export const fetchJson = async <T,>(path: string, options: IFetchJsonOptions = {}): Promise<T> => {
  const { auth: useAuthHeader = true, _refreshAttempted, ...init } = options;
  const url = `${envBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const hasBody = init.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = accessToken;
  if (useAuthHeader !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const parsed = isJson ? ((await res.json()) as unknown) : null;

  if (!res.ok) {
    if (
      res.status === 401 &&
      useAuthHeader !== false &&
      !_refreshAttempted &&
      path !== "/auth/refresh"
    ) {
      const refreshed = await refreshAccessSession();
      if (refreshed) {
        return fetchJson<T>(path, { ...options, _refreshAttempted: true });
      }
      clearAllStoredAuth();
      clearAccessToken();
    }
    const body = parsed && typeof parsed === "object" ? (parsed as IApiErrorBody) : null;
    const message = body?.message ?? res.statusText ?? "Request failed";
    throw new ApiError(res.status, message, body);
  }

  return parsed as T;
};
