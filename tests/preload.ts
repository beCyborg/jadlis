/**
 * Bun test preload — registers module mocks BEFORE any test file loads.
 * This ensures that modules with external dependencies (voyageai, ioredis,
 * bullmq) are properly mocked and don't cause import failures.
 *
 * Individual tests override specific behavior via DI setter functions
 * (_setVoyageClientForTest, _setQueueForTest, _setConnectionForTest).
 */
import { mock } from "bun:test";

mock.module("voyageai", () => ({
  VoyageAIClient: class {
    embed = async () => ({ data: [], usage: { totalTokens: 0 } });
  },
}));

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

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: async () => ({ data: null, error: null }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));
