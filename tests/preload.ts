/**
 * Bun test preload — registers module mocks BEFORE any test file loads.
 *
 * Mocked: bullmq — Queue/Worker create real connections at instantiation
 * and must be mocked before notificationQueue.ts loads.
 *
 * NOT mocked here:
 * - ioredis — connection.ts uses lazy init; each test mocks it individually
 * - voyageai, @supabase/supabase-js — lazy require() in embeddings.ts
 * - Individual tests use DI setters for specific behavior.
 */
import { mock } from "bun:test";

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
