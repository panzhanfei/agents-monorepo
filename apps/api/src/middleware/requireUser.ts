import type { NextFunction, Request, Response } from "express";
import { HttpError, prisma, verifyUserAccessToken, toAuthUserPayload, userAgentSlotAuthSelect } from "@/lib";

const BEARER = /^Bearer\s+(.+)$/i;

export const requireUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !BEARER.test(header)) {
      throw new HttpError(401, "unauthorized", "Missing bearer token");
    }
    const token = header.match(BEARER)?.[1];
    if (!token) throw new HttpError(401, "unauthorized", "Missing bearer token");

    let claims;
    try {
      claims = verifyUserAccessToken(token);
    } catch {
      throw new HttpError(401, "invalid_token", "Invalid access token");
    }

    const row = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        agentSlotConfigs: { select: userAgentSlotAuthSelect },
      },
    });
    if (!row) throw new HttpError(401, "invalid_token", "User not found");

    req.authUser = toAuthUserPayload(row, row.agentSlotConfigs);
    next();
  } catch (e) {
    next(e);
  }
};
