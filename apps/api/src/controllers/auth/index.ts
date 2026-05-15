import type { RequestHandler } from "express";
import { z } from "zod";
import { HttpError, requireUserIdOrThrow } from "@/lib";
import {
  patchAgentSlotsByUserId,
  loginUser,
  refreshAccessPair,
  registerUser,
  runInferenceProbeForSlot,
} from "@/services/auth";
import type { IAuthMeResponse } from "@agents/shared-types";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = registerSchema;

const slotKeyEnum = z.enum([
  "router",
  "analyst",
  "architect",
  "coder",
  "reviewer",
  "verifier",
  "ops",
]);

const agentSlotPatchSchema = z.object({
  mode: z.enum(["local", "hosted"]),
  model: z.string().min(1).max(200),
  baseUrl: z.union([z.string().max(2048), z.null()]).optional(),
  hostedProvider: z.union([z.string().max(64), z.null()]).optional(),
  apiKey: z.union([z.string().max(8192), z.null()]).optional(),
});

const agentSlotEntrySchema = z.union([agentSlotPatchSchema, z.null()]);

const patchMeSchema = z
  .object({
    agentSlots: z.record(slotKeyEnum, agentSlotEntrySchema),
  })
  .refine((v) => Object.keys(v.agentSlots).length > 0, { message: "No slots to update" });

const inferenceTestBodySchema = z.object({
  slotKey: slotKeyEnum,
  model: z.string().max(200).optional(),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const postRegister: RequestHandler = async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const payload = await registerUser(body.email, body.password);
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

const postLogin: RequestHandler = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const payload = await loginUser(body.email, body.password);
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const getMe: RequestHandler = async (req, res, next) => {
  try {
    const sessionUser = req.authUser;
    if (!sessionUser) throw new HttpError(401, "unauthorized", "Unauthorized");
    const payload: IAuthMeResponse = { user: sessionUser };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const patchMe: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = patchMeSchema.parse(req.body);
    const payload = await patchAgentSlotsByUserId(userId, body.agentSlots);
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const postInferenceTest: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = inferenceTestBodySchema.parse(req.body ?? {});
    const modelOverride = body.model?.trim();
    const payload = await runInferenceProbeForSlot(userId, body.slotKey, modelOverride);
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const postRefresh: RequestHandler = async (req, res, next) => {
  try {
    const body = refreshBodySchema.parse(req.body);
    const pair = await refreshAccessPair(body.refreshToken);
    if (!pair) {
      throw new HttpError(401, "invalid_refresh", "Invalid or expired refresh token");
    }
    res.json(pair);
  } catch (e) {
    next(e);
  }
};

export const authController = {
  postRegister,
  postLogin,
  getMe,
  patchMe,
  postInferenceTest,
  postRefresh,
};
