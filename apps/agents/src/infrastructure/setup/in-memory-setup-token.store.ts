import crypto from "node:crypto";
import type { ISetupTokenStore } from "@/domain/setup/ports/setup-token.store";

export const createInMemorySetupTokenStore = (): ISetupTokenStore => {
  let pending: string | null = null;
  return {
    getPending: () => pending,
    setPending: (token: string) => {
      pending = token;
    },
    clearPending: () => {
      pending = null;
    },
    newToken: () => crypto.randomBytes(18).toString("base64url"),
  };
};
