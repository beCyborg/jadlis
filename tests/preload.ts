/**
 * Bun test preload — registers module mocks BEFORE any test file loads.
 *
 * Mocked: ioredis — prevents real Redis connections. Connection.ts creates
 * real IORedis instances at getRedisConnection() call time. Without this mock,
 * open handles prevent process exit.
 *
 * NOT mocked here:
 * - bullmq — individual tests mock it via mock.module (Queue/Worker are lazy)
 * - voyageai, @supabase/supabase-js — lazy require() in embeddings.ts
 */
import { mock } from "bun:test";

mock.module("ioredis", () => ({
  default: class MockIORedis {
    _url: string;
    _opts: unknown;
    status = "ready";

    constructor(url?: string, opts?: unknown) {
      this._url = url ?? "";
      this._opts = opts ?? {};
    }

    disconnect() {}
    connect() {
      return Promise.resolve();
    }
  },
}));
