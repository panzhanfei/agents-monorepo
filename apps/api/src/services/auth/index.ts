import type {
  IAuthInferenceTestResponse,
  IAuthMeResponse,
  IAuthRefreshResponse,
  IAuthSessionResponse,
} from "@agents/shared-types";
import {
  hashPassword,
  verifyPassword,
  signUserAccessToken,
  HttpError,
  issueRefreshSession,
  rotateRefreshSession,
  toAuthUserPayload,
  mergeAgentSlotForPersist,
  runInferenceProbe,
  prisma,
} from "@/lib";
import {
  createUserWithSlotSelect,
  findAgentSlotInferenceRow,
  findUserIdByEmail,
  findUserLoginRow,
  loadUserWithSlotRows,
  txDeleteAgentSlotByKey,
  txFindAgentSlot,
  txUpsertAgentSlot,
} from "@/models/auth";

export type IAgentSlotPersistPatch = {
  mode: "local" | "hosted";
  model: string;
  baseUrl?: string | null;
  hostedProvider?: string | null;
  apiKey?: string | null;
};

export const registerUser = async (email: string, password: string): Promise<IAuthSessionResponse> => {
  const existing = await findUserIdByEmail(email);
  if (existing) throw new HttpError(409, "email_taken", "Email already registered");

  const passwordHash = await hashPassword(password);
  const created = await createUserWithSlotSelect(email, passwordHash);

  const accessToken = signUserAccessToken(created.id);
  const refreshToken = await issueRefreshSession(created.id);
  return {
    user: toAuthUserPayload({ id: created.id, email: created.email }, created.agentSlotConfigs),
    accessToken,
    refreshToken,
  };
};

export const loginUser = async (email: string, password: string): Promise<IAuthSessionResponse> => {
  const row = await findUserLoginRow(email);
  if (!row) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

  const accessToken = signUserAccessToken(row.id);
  const refreshToken = await issueRefreshSession(row.id);
  return {
    user: toAuthUserPayload({ id: row.id, email: row.email }, row.agentSlotConfigs),
    accessToken,
    refreshToken,
  };
};

export const patchAgentSlotsByUserId = async (
  userId: string,
  agentSlots: Record<string, IAgentSlotPersistPatch | null>,
): Promise<IAuthMeResponse> => {
  await prisma.$transaction(async (tx) => {
    for (const [slotKey, patch] of Object.entries(agentSlots)) {
      if (patch === null) {
        await txDeleteAgentSlotByKey(tx, userId, slotKey);
        continue;
      }
      const existing = await txFindAgentSlot(tx, userId, slotKey);
      const data = mergeAgentSlotForPersist(existing, patch);
      await txUpsertAgentSlot(tx, {
        userId,
        slotKey,
        create: {
          user: { connect: { id: userId } },
          slotKey,
          ...data,
        },
        update: data,
      });
    }
  });

  const [userRow, slotRows] = await loadUserWithSlotRows(userId);
  return {
    user: toAuthUserPayload(userRow, slotRows),
  };
};

export const runInferenceProbeForSlot = async (
  userId: string,
  slotKey: string,
  modelHintOverride?: string,
): Promise<IAuthInferenceTestResponse> => {
  const row = await findAgentSlotInferenceRow(userId, slotKey);
  if (!row) {
    return {
      ok: false,
      probe: "skipped",
      message: "该槽位尚未保存配置，请先填写并保存。",
    };
  }
  const modelHint = modelHintOverride?.trim() || row.modelId;
  return runInferenceProbe({
    inferenceMode: row.inferenceMode,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    modelHint,
  });
};

export const refreshAccessPair = async (refreshToken: string): Promise<IAuthRefreshResponse | null> =>
  rotateRefreshSession(refreshToken);
