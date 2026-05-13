import { fetchJson } from "./client";
import type { IAuthMeResponse, IAuthRefreshResponse, IAuthSessionResponse } from "./interface";

export type ILoginBody = {
  email: string;
  password: string;
};

export const postLogin = (body: ILoginBody): Promise<IAuthSessionResponse> =>
  fetchJson<IAuthSessionResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(body),
  });

export const postRegister = (body: ILoginBody): Promise<IAuthSessionResponse> =>
  fetchJson<IAuthSessionResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(body),
  });

export const fetchMe = (): Promise<IAuthMeResponse> => fetchJson<IAuthMeResponse>("/auth/me");

export const postRefresh = (refreshToken: string): Promise<IAuthRefreshResponse> =>
  fetchJson<IAuthRefreshResponse>("/auth/refresh", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ refreshToken }),
  });
