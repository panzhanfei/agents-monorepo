import jwt, { type SignOptions } from "jsonwebtoken";
import { getEnv } from "@/config";

export type IAccessClaims = {
  sub: string;
  typ: "user";
};

export const signUserAccessToken = (userId: string): string => {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: userId, typ: "user" } satisfies IAccessClaims, env.JWT_SECRET, options);
};

export const verifyUserAccessToken = (token: string): IAccessClaims => {
  const env = getEnv();
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload !== "object" || payload === null) {
    throw new Error("invalid_token");
  }
  const sub = (payload as { sub?: unknown }).sub;
  const typ = (payload as { typ?: unknown }).typ;
  if (typeof sub !== "string" || typ !== "user") {
    throw new Error("invalid_token");
  }
  return { sub, typ };
};
