import { prisma, getRedis } from "@/lib";

export const probeDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export const probeRedis = async (): Promise<boolean> => {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
};
