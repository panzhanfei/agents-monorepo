import { Router } from "express";
import type { RequestHandler } from "express";
import type { IAuthMeResponse, IAuthSessionResponse } from "@agents/shared-types";
import { z } from "zod";
import { prisma, hashPassword, verifyPassword, signUserAccessToken, HttpError } from "@/lib";
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
    const payload: IAuthSessionResponse = { user, accessToken };
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
    const payload: IAuthSessionResponse = {
      user: { id: user.id, email: user.email },
      accessToken,
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

const handleRefreshPlaceholder: RequestHandler = (_req, res) => {
  res.status(501).json({
    code: "not_implemented",
    message: "Refresh token flow is not implemented in phase 1",
  });
};

authRouter.post("/register", handleRegister);
authRouter.post("/login", handleLogin);
authRouter.get("/me", requireUser, handleMe);
authRouter.post("/refresh", handleRefreshPlaceholder);
