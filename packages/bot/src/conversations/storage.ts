import type { ConversationData, VersionedState } from "@grammyjs/conversations";
import { getRedisConnection } from "../queue/connection";

const KEY_PREFIX = "jadlis:conv:";

/**
 * Redis-based storage adapter for grammY Conversations plugin.
 * Uses the shared Redis connection from queue/connection.ts.
 */
export function createRedisStorage() {
  const redis = getRedisConnection();
  return {
    async read(key: string): Promise<VersionedState<ConversationData> | undefined> {
      const raw = await redis.get(`${KEY_PREFIX}${key}`);
      if (!raw) return undefined;
      return JSON.parse(raw) as VersionedState<ConversationData>;
    },
    async write(key: string, state: VersionedState<ConversationData>): Promise<void> {
      // TTL 24h — conversations should not live longer than a day
      await redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(state), "EX", 86400);
    },
    async delete(key: string): Promise<void> {
      await redis.del(`${KEY_PREFIX}${key}`);
    },
  };
}
