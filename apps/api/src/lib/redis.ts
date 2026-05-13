import { Redis } from "ioredis";
import { getEnv } from "@/config";

let client: Redis | null = null;

export const getRedis = (): Redis => {
  if (!client) {
    client = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return client;
};

export const closeRedis = async (): Promise<void> => {
  if (!client) return;
  await client.quit();
  client = null;
};
