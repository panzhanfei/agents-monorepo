import { Redis } from "ioredis";
import { getEnv } from "../config/env.js";

let redis: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redis) {
    const { REDIS_URL } = getEnv();
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
};
