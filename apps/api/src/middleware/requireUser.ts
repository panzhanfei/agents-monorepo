import type { NextFunction, Request, Response } from "express";
import { HttpError, prisma, verifyUserAccessToken } from "@/lib";

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

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true },
    });
    if (!user) throw new HttpError(401, "invalid_token", "User not found");

    req.authUser = user;
    next();
  } catch (e) {
    next(e);
  }
};
