import { Router } from "express";
import type { RequestHandler } from "express";
import type { IAuthMeResponse, IAuthRefreshResponse, IAuthSessionResponse } from "@agents/shared-types";
import { z } from "zod";
import { prisma, hashPassword, verifyPassword, signUserAccessToken, HttpError, issueRefreshSession, rotateRefreshSession } from "@/lib";
import { requireUser } from "@/middleware";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = registerSchema;

const handleRegister: RequestHandler = async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "email_taken", "Email already registered");

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true },
    });

    const accessToken = signUserAccessToken(user.id);
    const refreshToken = await issueRefreshSession(user.id);
    const payload: IAuthSessionResponse = { user, accessToken, refreshToken };
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

const handleLogin: RequestHandler = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

    const accessToken = signUserAccessToken(user.id);
    const refreshToken = await issueRefreshSession(user.id);
    const payload: IAuthSessionResponse = {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const handleMe: RequestHandler = async (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) throw new HttpError(401, "unauthorized", "Unauthorized");
    const payload: IAuthMeResponse = { user };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const handleRefresh: RequestHandler = async (req, res, next) => {
  try {
    const body = refreshBodySchema.parse(req.body);
    const pair = await rotateRefreshSession(body.refreshToken);
    if (!pair) {
      throw new HttpError(401, "invalid_refresh", "Invalid or expired refresh token");
    }
    const payload: IAuthRefreshResponse = {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

authRouter.post("/register", handleRegister);
authRouter.post("/login", handleLogin);
authRouter.get("/me", requireUser, handleMe);
authRouter.post("/refresh", handleRefresh);
