import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { getEnv } from "@/config";

export type IAccessClaims = {
  sub: string;
  typ: "user";
};

export type IRefreshClaims = {
  sub: string;
  typ: "refresh";
  jti: string;
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

export const signRefreshToken = (userId: string, jti: string): string => {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ sub: userId, typ: "refresh", jti } satisfies IRefreshClaims, env.JWT_SECRET, options);
};

export const verifyRefreshToken = (token: string): IRefreshClaims => {
  const env = getEnv();
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload !== "object" || payload === null) {
    throw new Error("invalid_token");
  }
  const p = payload as JwtPayload & { typ?: unknown; jti?: unknown; sub?: unknown };
  const sub = p.sub;
  const typ = p.typ;
  const jti = p.jti;
  if (typeof sub !== "string" || typ !== "refresh" || typeof jti !== "string" || !jti) {
    throw new Error("invalid_token");
  }
  return { sub, typ, jti };
};

export const decodeRefreshExpiry = (token: string): Date => {
  const decoded = jwt.decode(token);
  if (typeof decoded !== "object" || decoded === null || !("exp" in decoded)) {
    throw new Error("invalid_token");
  }
  const exp = (decoded as { exp?: unknown }).exp;
  if (typeof exp !== "number") {
    throw new Error("invalid_token");
  }
  return new Date(exp * 1000);
};
