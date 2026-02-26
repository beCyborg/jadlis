import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { Hono } from "hono";

// Mock ioredis + bullmq (required by server.ts → ./queue)
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

// Mock modules required by server.ts imports
mock.module("@tma.js/init-data-node/web", () => ({
  validate: async () => {},
}));

mock.module("../db", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
    }),
  },
}));

// Minimal mock supabase for createApp
const mockSupabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
} as any;

// ============================================================
// 1. Health Endpoint Tests
// ============================================================
describe("Health endpoint", () => {
  let app: Hono;

  beforeEach(async () => {
    // Set production to skip Bull Board (avoids "matcher already built" error)
    process.env.NODE_ENV = "production";
    const { createApp } = await import("../server");
    app = createApp({ bot: null as any, supabase: mockSupabase });
  });

  test("GET /health returns 200 with {ok: true}", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.uptime).toBe("number");
  });

  test("unknown route returns 404", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 2. Session Adapter Tests
// ============================================================
describe("Session adapter", () => {
  test("read() returns undefined when no session exists", async () => {
    const { SupabaseSessionAdapter } = await import("../middleware/session");
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };
    const adapter = new SupabaseSessionAdapter(mockSupabase as any);
    const result = await adapter.read("nonexistent");
    expect(result).toBeUndefined();
  });

  test("write() performs upsert with value", async () => {
    const { SupabaseSessionAdapter } = await import("../middleware/session");
    let upsertCalled = false;
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: async (data: any) => {
          upsertCalled = true;
          expect(data.key).toBe("123");
          expect(data.value).toBeDefined();
          return { error: null };
        },
      }),
    };
    const adapter = new SupabaseSessionAdapter(mockSupabase as any);
    await adapter.write("123", {
      step: "idle",
      current_ritual: null,
      conversation_context: "",
      processing: false,
      working_memory_cache: "",
      working_memory_updated_at: null,
      message_count: 0,
    });
    expect(upsertCalled).toBe(true);
  });

  test("write() skips upsert when data unchanged (dirty flag)", async () => {
    const { SupabaseSessionAdapter } = await import("../middleware/session");
    const sessionData = {
      step: "idle",
      current_ritual: null,
      conversation_context: "",
      processing: false,
      working_memory_cache: "",
      working_memory_updated_at: null,
      message_count: 0,
    };
    let upsertCalled = false;
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { value: sessionData }, error: null }),
          }),
        }),
        upsert: async () => {
          upsertCalled = true;
          return { error: null };
        },
      }),
    };
    const adapter = new SupabaseSessionAdapter(mockSupabase as any);
    await adapter.write("123", sessionData);
    expect(upsertCalled).toBe(false);
  });

  test("setProcessingAtomic() returns true on success, false if already processing", async () => {
    const { setProcessingAtomic } = await import("../middleware/session");

    // Success case
    const mockSuccess = {
      rpc: async () => ({ data: true, error: null }),
    };
    const result1 = await setProcessingAtomic(mockSuccess as any, "123");
    expect(result1).toBe(true);

    // Already processing case
    const mockFail = {
      rpc: async () => ({ data: false, error: null }),
    };
    const result2 = await setProcessingAtomic(mockFail as any, "123");
    expect(result2).toBe(false);
  });
});

// ============================================================
// 3. Middleware Tests
// ============================================================
describe("Middleware chain", () => {
  test("error boundary catches errors and replies with user-friendly message", async () => {
    const { errorBoundary } = await import("../middleware/error");
    let repliedWith = "";
    const mockCtx = {
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await errorBoundary(mockCtx as any, async () => {
      throw new Error("test error");
    });
    expect(repliedWith).toContain("ошибка");
  });

  test("dedup guard replies with processing message when session.processing=true", async () => {
    const { dedupGuard } = await import("../middleware/dedup");
    let repliedWith = "";
    let nextCalled = false;
    const mockCtx = {
      session: { processing: true },
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await dedupGuard(mockCtx as any, async () => {
      nextCalled = true;
    });
    expect(repliedWith).toContain("Обрабатываю");
    expect(nextCalled).toBe(false);
  });

  test("auth middleware rejects unknown telegram_id", async () => {
    const { createAuthMiddleware } = await import("../middleware/auth");
    let repliedWith = "";
    let nextCalled = false;
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };
    const auth = createAuthMiddleware(mockSupabase as any);
    const mockCtx = {
      from: { id: 999999 },
      message: { text: "/status" },
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await auth(mockCtx as any, async () => {
      nextCalled = true;
    });
    expect(repliedWith).toContain("Доступ");
    expect(nextCalled).toBe(false);
  });
});

// ============================================================
// 4. Command Handler Tests
// ============================================================
describe("Commands", () => {
  test("/start creates new user when not in DB", async () => {
    const { createStartHandler } = await import("../handlers/start");
    let insertedData: any = null;
    const replies: string[] = [];
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
        insert: async (data: any) => {
          insertedData = data;
          return { error: null };
        },
      }),
    };
    const handler = createStartHandler(mockSupabase as any);
    const mockCtx = {
      from: { id: 12345, username: "testuser" },
      reply: async (msg: string, _opts?: any) => {
        replies.push(msg);
      },
      session: {} as any,
    };
    await handler(mockCtx as any);
    expect(insertedData).toBeDefined();
    expect(insertedData.telegram_id).toBe(12345);
    expect(replies[0]).toContain("Jadlis");
  });

  test("/start sends welcome message for existing user", async () => {
    const { createStartHandler } = await import("../handlers/start");
    let repliedWith = "";
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: "uuid", telegram_id: 12345, username: "test" },
              error: null,
            }),
          }),
        }),
      }),
    };
    const handler = createStartHandler(mockSupabase as any);
    const mockCtx = {
      from: { id: 12345, username: "testuser" },
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await handler(mockCtx as any);
    expect(repliedWith).toContain("С возвращением");
  });

  test("/help returns command list", async () => {
    const { handleHelp } = await import("../handlers/help");
    let repliedWith = "";
    const mockCtx = {
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await handleHelp(mockCtx as any);
    expect(repliedWith).toContain("/start");
    expect(repliedWith).toContain("/help");
    expect(repliedWith).toContain("/status");
    expect(repliedWith).toContain("/goals");
    expect(repliedWith).toContain("/habits");
  });

  test("/status returns raw data without AI call", async () => {
    const { createStatusHandler } = await import("../handlers/status");
    let repliedWith = "";
    const mockSupabase = {
      from: (table: string) => {
        if (table === "needs") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ name: "sleep", current_score: 75 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "habits") {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({
                  data: [{ name: "Meditation", momentum: 80, streak: 5 }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "goals") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [{ title: "Learn Rust", progress: 30 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ data: [], error: null }) }) };
      },
    };
    const handler = createStatusHandler(mockSupabase as any);
    const mockCtx = {
      userId: "user-uuid-123",
      reply: async (msg: string) => {
        repliedWith = msg;
      },
    };
    await handler(mockCtx as any);
    expect(repliedWith.length).toBeGreaterThan(0);
    expect(repliedWith).toContain("sleep");
  });
});
