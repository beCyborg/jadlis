/**
 * Bun test preload — registers module mocks BEFORE any test file loads.
 *
 * Mocked: ioredis, bullmq — these create real connections at instantiation
 * and must be mocked before connection.ts / notificationQueue.ts load.
 *
 * NOT mocked here:
 * - voyageai, @supabase/supabase-js — lazy require() in embeddings.ts
 * - Individual tests use DI setters for specific behavior.
 */
import { mock } from "bun:test";

mock.module("ioredis", () => ({
  default: class {
    disconnect() {}
    connect() {
      return Promise.resolve();
    }
    status = "ready";
  },
}));

mock.module("bullmq", () => ({
  Queue: class {
    add = async () => {};
    upsertJobScheduler = async () => {};
    removeJobScheduler = async () => {};
    getJobCounts = async () => ({});
    getJob = async () => null;
  },
  Worker: class {
    on() {
      return this;
    }
  },
  UnrecoverableError: class extends Error {},
}));
