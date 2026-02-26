import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================================
// Mock ioredis + bullmq (required by server.ts → ./queue)
// ============================================================
mock.module("ioredis", () => ({
  default: mock(() => ({
    disconnect: mock(() => {}),
    connect: mock(() => Promise.resolve()),
    status: "ready",
  })),
}));
mock.module("bullmq", () => ({
  Queue: mock(() => ({
    add: mock(() => Promise.resolve()),
    upsertJobScheduler: mock(() => Promise.resolve()),
    removeJobScheduler: mock(() => Promise.resolve()),
    getJobCounts: mock(() => Promise.resolve({})),
    getJob: mock(() => Promise.resolve(null)),
  })),
  Worker: mock(() => ({ on: mock(() => ({})) })),
  UnrecoverableError: class extends Error {},
}));

// ============================================================
// Mock @tma.js/init-data-node/web (needed when importing server.ts)
// ============================================================
mock.module("@tma.js/init-data-node/web", () => ({
  validate: async () => {},
}));

// ============================================================
// Mock Supabase
// ============================================================
let insertedRows: any[] = [];
let existingMetricValues: any[] = [];

function createMockSupabase() {
  return {
    from: (table: string) => {
      const chain: any = {};

      if (table === "metrics") {
        chain.select = () => chain;
        chain.eq = (_col: string, val: string) => {
          chain._code = val;
          return chain;
        };
        chain.single = async () => {
          // Map metric codes to metric IDs
          const codeToId: Record<string, string> = {
            S02: "metric-sleep-duration",
            M04: "metric-steps",
            H07: "metric-resting-hr",
            M01: "metric-active-calories",
          };
          const id = codeToId[chain._code];
          if (id) {
            return { data: { id, code: chain._code, scale_type: "P1", scale_min: 0, scale_max: 100 }, error: null };
          }
          return { data: null, error: null };
        };
        return chain;
      }

      if (table === "metric_values") {
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.single = async () => ({ data: null, error: null });
        chain.upsert = async (row: any) => {
          insertedRows.push(row);
          return { error: null };
        };
        return chain;
      }

      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = async () => ({ data: null, error: null });
      return chain;
    },
  };
}

mock.module("../../db", () => ({
  supabase: createMockSupabase(),
}));

// ============================================================
// Tests
// ============================================================

describe("POST /ingest/health", () => {
  beforeEach(() => {
    insertedRows = [];
    existingMetricValues = [];
    process.env.HAE_INGEST_SECRET = "test-hae-secret";
  });

  test("accepts valid health JSON with Bearer HAE_INGEST_SECRET", async () => {
    const { createIngestRouter } = await import("../../ingest/health");
    const app = new Hono();
    app.route("/ingest", createIngestRouter(createMockSupabase() as any));

    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [{ qty: 7.5, date: "2026-02-24T00:00:00Z" }],
          },
        ],
      },
    };

    const res = await app.request("/ingest/health", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-hae-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.inserted).toBe("number");
  });

  test("rejects request without Authorization header", async () => {
    const { createIngestRouter } = await import("../../ingest/health");
    const app = new Hono();
    app.route("/ingest", createIngestRouter(createMockSupabase() as any));

    const res = await app.request("/ingest/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { metrics: [] } }),
    });

    expect(res.status).toBe(401);
  });

  test("rejects request with wrong secret", async () => {
    const { createIngestRouter } = await import("../../ingest/health");
    const app = new Hono();
    app.route("/ingest", createIngestRouter(createMockSupabase() as any));

    const res = await app.request("/ingest/health", {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { metrics: [] } }),
    });

    expect(res.status).toBe(401);
  });

  test("validates payload structure via Zod schema (rejects missing fields)", async () => {
    const { createIngestRouter } = await import("../../ingest/health");
    const app = new Hono();
    app.route("/ingest", createIngestRouter(createMockSupabase() as any));

    const res = await app.request("/ingest/health", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-hae-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invalid: "payload" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("maps sleep_analysis to correct Jadlis metric code S02", async () => {
    const { HAE_TO_JADLIS_METRIC } = await import("../../ingest/health");

    expect(HAE_TO_JADLIS_METRIC["sleep_analysis"]).toBe("S02");
  });

  test("writes metric_values with source='auto'", async () => {
    const { createIngestRouter } = await import("../../ingest/health");
    const mockSb = createMockSupabase();
    const app = new Hono();
    app.route("/ingest", createIngestRouter(mockSb as any));

    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [{ qty: 7.5, date: "2026-02-24T00:00:00Z" }],
          },
        ],
      },
    };

    await app.request("/ingest/health", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-hae-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(insertedRows.length).toBeGreaterThan(0);
    expect(insertedRows[0].source).toBe("auto");
  });
});

describe("POST /cron/daily-digest", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NODE_ENV = "production";
  });

  test("accepts request with correct Bearer CRON_SECRET", async () => {
    const { createApp } = await import("../../server");
    const app = createApp({ bot: null as any, supabase: createMockSupabase() as any });

    const res = await app.request("/cron/daily-digest", {
      method: "POST",
      headers: { Authorization: "Bearer test-cron-secret" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("rejects request without Authorization header", async () => {
    const { createApp } = await import("../../server");
    const app = createApp({ bot: null as any, supabase: createMockSupabase() as any });

    const res = await app.request("/cron/daily-digest", {
      method: "POST",
    });

    expect(res.status).toBe(401);
  });

  test("rejects request with wrong CRON_SECRET", async () => {
    const { createApp } = await import("../../server");
    const app = createApp({ bot: null as any, supabase: createMockSupabase() as any });

    const res = await app.request("/cron/daily-digest", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    expect(res.status).toBe(401);
  });
});
