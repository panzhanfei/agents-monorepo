import { ApiError, apiSetAccessToken, clearAccessToken, fetchJson, type IAuthMeResponse } from "@/api";
import type { IAuthUser } from "./interface";

export type IRestoreSessionResult =
  | { ok: true; user: IAuthUser }
  | { ok: false; cleared: boolean };

export const restoreSessionFromToken = async (token: string): Promise<IRestoreSessionResult> => {
  apiSetAccessToken(token);
  try {
    const me = await fetchJson<IAuthMeResponse>("/auth/me");
    return { ok: true, user: me.user };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      clearAccessToken();
      return { ok: false, cleared: true };
    }
    return { ok: false, cleared: false };
  }
};
