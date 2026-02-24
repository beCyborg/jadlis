import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================================
// Mock @tma.js/init-data-node/web — must be before imports
// ============================================================
let validateShouldThrow = false;
let validateCallArgs: any[] = [];

mock.module("@tma.js/init-data-node/web", () => ({
  validate: async (...args: any[]) => {
    validateCallArgs.push(args);
    if (validateShouldThrow) {
      throw new Error("Validation failed");
    }
  },
}));

// ============================================================
// Mock Data
// ============================================================
const mockNeeds = [
  { id: "n1", name: "sleep", current_score: 75, target_score: 80 },
  { id: "n2", name: "nutrition", current_score: 60, target_score: 70 },
];
const mockHabits = [
  { id: "h1", name: "Meditation", momentum: 80, streak: 5, grace_days: 2 },
];
const mockGoals = [
  { id: "g1", title: "Learn Rust", progress: 30, status: "active", stages: [] },
];
const mockDays = [
  { id: "d1", date: "2026-02-24", overall_score: 72, zone: "green" },
  { id: "d2", date: "2026-02-23", overall_score: 65, zone: "yellow" },
];

// Mock supabase that handles user lookup + data queries
function createMockSupabase() {
  return {
    from: (table: string) => {
      const chain: any = {};

      if (table === "users") {
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.single = async () => ({
          data: { id: "user-uuid-123" },
          error: null,
        });
        return chain;
      }

      let data: any[];
      switch (table) {
        case "needs":
          data = mockNeeds;
          break;
        case "habits":
          data = mockHabits;
          break;
        case "goals":
          data = mockGoals;
          break;
        case "days":
          data = mockDays;
          break;
        default:
          data = [];
      }

      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.then = (resolve: any) => resolve({ data, error: null });

      return chain;
    },
  };
}

mock.module("../../db", () => ({
  supabase: createMockSupabase(),
}));

// Valid initData with encoded user JSON
const validInitData = `user=${encodeURIComponent(JSON.stringify({ id: 12345, username: "testuser" }))}`;

// ============================================================
// 1. HMAC Middleware Tests
// ============================================================
describe("HMAC middleware", () => {
  beforeEach(() => {
    validateShouldThrow = false;
    validateCallArgs = [];
  });

  test("validates correct Telegram initData signature", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/needs", {
      headers: { "X-Telegram-Init-Data": validInitData },
    });

    expect(res.status).toBe(200);
    expect(validateCallArgs.length).toBeGreaterThan(0);
  });

  test("rejects request without X-Telegram-Init-Data header", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/needs");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("rejects tampered/expired initData", async () => {
    validateShouldThrow = true;
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/needs", {
      headers: { "X-Telegram-Init-Data": "tampered-data" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});

// ============================================================
// 2. API Route Tests
// ============================================================
describe("GET /api/needs", () => {
  beforeEach(() => {
    validateShouldThrow = false;
    validateCallArgs = [];
  });

  test("returns needs array for valid authenticated user", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/needs", {
      headers: { "X-Telegram-Init-Data": validInitData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0].name).toBe("sleep");
  });
});

describe("GET /api/habits", () => {
  beforeEach(() => {
    validateShouldThrow = false;
    validateCallArgs = [];
  });

  test("returns habits with momentum values", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/habits", {
      headers: { "X-Telegram-Init-Data": validInitData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].momentum).toBe(80);
  });

  test("returns 401 without valid initData header", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/habits");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/goals", () => {
  beforeEach(() => {
    validateShouldThrow = false;
  });

  test("returns goals array", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/goals", {
      headers: { "X-Telegram-Init-Data": validInitData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("GET /api/days", () => {
  beforeEach(() => {
    validateShouldThrow = false;
  });

  test("returns days with default range=7", async () => {
    const { createApiRouter } = await import("../../api/index");
    const app = new Hono();
    app.route("/api", createApiRouter(createMockSupabase() as any));

    const res = await app.request("/api/days", {
      headers: { "X-Telegram-Init-Data": validInitData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
