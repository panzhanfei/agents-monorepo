import type { IAuthUser } from "@agents/shared-types";

export type { IAuthUser };

export type IAuthContextValue = {
  accessToken: string | null;
  user: IAuthUser | null;
  setSession: (token: string, user: IAuthUser) => void;
  clearSession: () => void;
};
