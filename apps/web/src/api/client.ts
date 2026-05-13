import type { IApiErrorBody, IFetchJsonOptions } from "./interface";
const envBase = (): string => import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:3000";

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

export const fetchJson = async <T,>(path: string, options: IFetchJsonOptions = {}): Promise<T> => {
  const url = `${envBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = accessToken;
  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const parsed = isJson ? ((await res.json()) as unknown) : null;

  if (!res.ok) {
    const body = parsed && typeof parsed === "object" ? (parsed as IApiErrorBody) : null;
    const message = body?.message ?? res.statusText ?? "Request failed";
    throw new ApiError(res.status, message, body);
  }

  return parsed as T;
};
