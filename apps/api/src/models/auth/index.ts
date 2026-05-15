import type { Prisma } from "@prisma/client";
import { prisma, userAgentSlotAuthSelect } from "@/lib";

export const findUserIdByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, select: { id: true } });

export const createUserWithSlotSelect = (email: string, passwordHash: string) =>
  prisma.user.create({
    data: { email, passwordHash },
    select: {
      id: true,
      email: true,
      agentSlotConfigs: { select: userAgentSlotAuthSelect },
    },
  });

export const findUserLoginRow = (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      agentSlotConfigs: { select: userAgentSlotAuthSelect },
    },
  });

export const txDeleteAgentSlotByKey = (
  tx: Prisma.TransactionClient,
  userId: string,
  slotKey: string,
) => tx.userAgentSlotConfig.deleteMany({ where: { userId, slotKey } });

export const txFindAgentSlot = (
  tx: Prisma.TransactionClient,
  userId: string,
  slotKey: string,
) =>
  tx.userAgentSlotConfig.findUnique({
    where: { userId_slotKey: { userId, slotKey } },
  });

export const txUpsertAgentSlot = (
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    slotKey: string;
    create: Prisma.UserAgentSlotConfigCreateInput;
    update: Prisma.UserAgentSlotConfigUpdateInput;
  },
) =>
  tx.userAgentSlotConfig.upsert({
    where: { userId_slotKey: { userId: params.userId, slotKey: params.slotKey } },
    create: params.create,
    update: params.update,
  });

export const loadUserWithSlotRows = (userId: string) =>
  Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    }),
    prisma.userAgentSlotConfig.findMany({
      where: { userId },
      select: userAgentSlotAuthSelect,
    }),
  ]);

export const findAgentSlotInferenceRow = (userId: string, slotKey: string) =>
  prisma.userAgentSlotConfig.findUnique({
    where: { userId_slotKey: { userId, slotKey } },
    select: {
      inferenceMode: true,
      baseUrl: true,
      apiKey: true,
      modelId: true,
    },
  });
