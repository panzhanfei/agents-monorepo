import { randomUUID } from "node:crypto";
import { prisma } from "../common/prisma";
import { decodeRefreshExpiry, signRefreshToken, signUserAccessToken, verifyRefreshToken } from "./jwt";

export type IAuthRefreshPair = {
  accessToken: string;
  refreshToken: string;
};

export const issueRefreshSession = async (userId: string): Promise<string> => {
  const jti = randomUUID();
  const refreshToken = signRefreshToken(userId, jti);
  const expiresAt = decodeRefreshExpiry(refreshToken);
  await prisma.refreshToken.create({
    data: { userId, jti, expiresAt },
  });
  return refreshToken;
};

export const rotateRefreshSession = async (refreshTokenPlain: string): Promise<IAuthRefreshPair | null> => {
  let claims;
  try {
    claims = verifyRefreshToken(refreshTokenPlain);
  } catch {
    return null;
  }

  const row = await prisma.refreshToken.findUnique({
    where: { jti: claims.jti },
  });
  if (!row || row.userId !== claims.sub) {
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.deleteMany({ where: { jti: claims.jti } }).catch(() => undefined);
    return null;
  }

  const userId = claims.sub;
  const newJti = randomUUID();
  const nextRefresh = signRefreshToken(userId, newJti);
  const expiresAt = decodeRefreshExpiry(nextRefresh);

  try {
    await prisma.$transaction(async (tx) => {
      const del = await tx.refreshToken.deleteMany({ where: { jti: claims.jti, userId } });
      if (del.count !== 1) {
        throw new Error("refresh_already_used");
      }
      await tx.refreshToken.create({ data: { userId, jti: newJti, expiresAt } });
    });
  } catch {
    return null;
  }

  return {
    accessToken: signUserAccessToken(userId),
    refreshToken: nextRefresh,
  };
};
