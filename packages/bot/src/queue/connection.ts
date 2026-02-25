import IORedis from "ioredis";

let connection: IORedis | null = null;

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  };
}

/**
 * Returns a singleton IORedis connection configured for BullMQ.
 * BullMQ requires maxRetriesPerRequest: null.
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    connection.connect().catch((err) =>
      console.error("[redis] Connection failed:", err.message),
    );
  }
  return connection;
}

/**
 * Returns plain connection options (for BullMQ Queue/Worker config).
 */
export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  return {
    ...parseRedisUrl(redisUrl),
    maxRetriesPerRequest: null,
  };
}

/** Resets singleton (for testing). */
export function resetRedisConnection(): void {
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
