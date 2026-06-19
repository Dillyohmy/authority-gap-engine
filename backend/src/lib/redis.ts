import IORedis from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false";

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times: number) => Math.min(times * 500, 5000), // retry with backoff up to 5s
  enableOfflineQueue: true,
};

function logRedisError(err: Error) {
  logger.warn(
    { message: err.message, REDIS_URL },
    "Redis is unavailable. Start Redis before using scan queue endpoints."
  );
}

export const redis = new IORedis(REDIS_URL, redisOptions);
redis.on("error", logRedisError);

export const redisSubscriber = new IORedis(REDIS_URL, redisOptions);
redisSubscriber.on("error", logRedisError);
