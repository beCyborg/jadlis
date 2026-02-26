/**
 * Bun test preload — registers module mocks BEFORE any test file loads.
 *
 * Mocked: ioredis, bullmq — prevent real Redis/BullMQ connections.
 * Without these mocks, open handles prevent process exit.
 *
 * IMPORTANT: Individual test files that mock these modules will override
 * these preload mocks. The preload serves as a safety net for modules
 * that DON'T explicitly mock them.
 *
 * NOT mocked here:
 * - voyageai, @supabase/supabase-js — lazy require() in embeddings.ts
 */
import { mock } from "bun:test";

// Bun test has no --forceExit flag. Open handles from leaked mocks
// or real connections prevent process exit. Force exit after 60s —
// all tests complete in ~20s, so this is a generous safety net.
setTimeout(() => {
  process.exit(process.exitCode ?? 0);
}, 60_000);

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

// Store the last worker processor for tests that need to invoke it
let _lastWorkerProcessor: ((job: unknown) => Promise<void>) | null = null;

/** @internal Access the last registered Worker processor */
export function _getLastWorkerProcessor() {
  return _lastWorkerProcessor;
}

mock.module("bullmq", () => ({
  Queue: class {
    add = async () => {};
    upsertJobScheduler = async () => {};
    removeJobScheduler = async () => {};
    getJobCounts = async () => ({});
    getJob = async () => null;
  },
  Worker: class {
    constructor(_name: string, processor: (job: unknown) => Promise<void>) {
      _lastWorkerProcessor = processor;
    }
    on() {
      return this;
    }
  },
  UnrecoverableError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "UnrecoverableError";
    }
  },
}));
