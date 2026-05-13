import type { IAuthUser } from "@agents/shared-types";

export type { IAuthUser };

export type IAuthContextValue = {
  accessToken: string | null;
  user: IAuthUser | null;
  setSession: (accessToken: string, refreshToken: string, user: IAuthUser) => void;
  clearSession: () => void;
  reloadProfile: () => Promise<void>;
};
