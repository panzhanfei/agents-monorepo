import { Router, type RequestHandler } from "express";
import type {
  IAuthInferenceTestResponse,
  IAuthMeResponse,
  IAuthRefreshResponse,
  IAuthSessionResponse,
} from "@agents/shared-types";
import { z } from "zod";
import {
  prisma,
  hashPassword,
  verifyPassword,
  signUserAccessToken,
  HttpError,
  issueRefreshSession,
  rotateRefreshSession,
  requireUserIdOrThrow,
  toAuthUserPayload,
  userAgentSlotAuthSelect,
  mergeAgentSlotForPersist,
  runInferenceProbe,
} from "@/lib";
import { requireUser } from "@/middleware";

export const authRouter = Router();

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

const handleRegister: RequestHandler = async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "email_taken", "Email already registered");

    const passwordHash = await hashPassword(body.password);
    const created = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: {
        id: true,
        email: true,
        agentSlotConfigs: { select: userAgentSlotAuthSelect },
      },
    });

    const accessToken = signUserAccessToken(created.id);
    const refreshToken = await issueRefreshSession(created.id);
    const payload: IAuthSessionResponse = {
      user: toAuthUserPayload(
        { id: created.id, email: created.email },
        created.agentSlotConfigs,
      ),
      accessToken,
      refreshToken,
    };
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

const handleLogin: RequestHandler = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const row = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        agentSlotConfigs: { select: userAgentSlotAuthSelect },
      },
    });
    if (!row) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

    const ok = await verifyPassword(body.password, row.passwordHash);
    if (!ok) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

    const accessToken = signUserAccessToken(row.id);
    const refreshToken = await issueRefreshSession(row.id);
    const payload: IAuthSessionResponse = {
      user: toAuthUserPayload({ id: row.id, email: row.email }, row.agentSlotConfigs),
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
    const sessionUser = req.authUser;
    if (!sessionUser) throw new HttpError(401, "unauthorized", "Unauthorized");
    const payload: IAuthMeResponse = { user: sessionUser };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const handlePatchMe: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = patchMeSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      for (const [slotKey, patch] of Object.entries(body.agentSlots)) {
        if (patch === null) {
          await tx.userAgentSlotConfig.deleteMany({ where: { userId, slotKey } });
          continue;
        }
        const existing = await tx.userAgentSlotConfig.findUnique({
          where: { userId_slotKey: { userId, slotKey } },
        });
        const data = mergeAgentSlotForPersist(existing, patch);
        await tx.userAgentSlotConfig.upsert({
          where: { userId_slotKey: { userId, slotKey } },
          create: {
            userId,
            slotKey,
            ...data,
          },
          update: data,
        });
      }
    });

    const [userRow, slotRows] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, email: true },
      }),
      prisma.userAgentSlotConfig.findMany({
        where: { userId },
        select: userAgentSlotAuthSelect,
      }),
    ]);
    const payload: IAuthMeResponse = {
      user: toAuthUserPayload(userRow, slotRows),
    };
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

const inferenceTestBodySchema = z.object({
  slotKey: slotKeyEnum,
  model: z.string().max(200).optional(),
});

const handleInferenceTest: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireUserIdOrThrow(req);
    const body = inferenceTestBodySchema.parse(req.body ?? {});
    const row = await prisma.userAgentSlotConfig.findUnique({
      where: { userId_slotKey: { userId, slotKey: body.slotKey } },
      select: {
        inferenceMode: true,
        baseUrl: true,
        apiKey: true,
        modelId: true,
      },
    });
    if (!row) {
      const resBody: IAuthInferenceTestResponse = {
        ok: false,
        probe: "skipped",
        message: "该槽位尚未保存配置，请先填写并保存。",
      };
      res.json(resBody);
      return;
    }
    const modelHint = body.model?.trim() || row.modelId;
    const result = await runInferenceProbe({
      inferenceMode: row.inferenceMode,
      baseUrl: row.baseUrl,
      apiKey: row.apiKey,
      modelHint,
    });
    res.json(result);
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
authRouter.patch("/me", requireUser, handlePatchMe);
authRouter.post("/me/inference/test", requireUser, handleInferenceTest);
authRouter.post("/refresh", handleRefresh);
