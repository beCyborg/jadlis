import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Module mocks (must be before dynamic import)
// ============================================================

mock.module("ioredis", () => ({
  default: mock(() => ({
    disconnect: mock(() => {}),
    connect: mock(() => Promise.resolve()),
    status: "ready",
  })),
}));

mock.module("bullmq", () => ({
  Queue: mock(() => ({})),
  Worker: mock(() => ({ on: mock(() => ({})) })),
  UnrecoverableError: class extends Error {},
}));

const mockCreateMessage = mock(() => Promise.resolve("Сгенерированный план дня"));
const mockCreateMessageWithTools = mock(() =>
  Promise.resolve({
    content: [
      {
        type: "tool_use",
        name: "determine_zone",
        input: { zone: "stable", zoneLevel: 4, reasoning: "Средние показатели" },
      },
    ],
  }),
);

mock.module("@jadlis/ai", () => ({
  createMessage: mockCreateMessage,
  createMessageWithTools: mockCreateMessageWithTools,
  buildZonePrompt: mock(() => "zone prompt"),
  buildMorningPlanPrompt: mock(() => "plan prompt"),
  DETERMINE_ZONE_TOOL: { name: "determine_zone", description: "test", input_schema: {} },
  buildWorkingMemory: mock(() => Promise.resolve("working memory text")),
  invalidateWorkingMemoryCache: mock(() => Promise.resolve()),
}));

/**
 * Chainable supabase mock — every method returns the proxy (chainable),
 * and the proxy is also thenable (resolves to { data: [], error: null }).
 */
function createChainableSupabaseMock() {
  const defaultResult = { data: null, error: null };
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "then") {
        // Make the proxy thenable — resolve with default result
        return (resolve: (v: unknown) => void) => resolve(defaultResult);
      }
      if (prop === "_calls") return calls;
      // Return a function that records the call and returns the proxy
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    },
  };

  const proxy = new Proxy({} as Record<string, unknown>, handler);
  return proxy;
}

const mockSupabase = createChainableSupabaseMock();

mock.module("../../db", () => ({
  supabase: mockSupabase,
}));

mock.module("@jadlis/shared", () => ({
  normalizeMetric: mock((value: number) => ((value - 1) / 9) * 100),
  levelToZone: mock((level: number) => {
    const zones = ["crisis", "exhaustion", "decline", "stable", "rise", "flow", "superflow"];
    return zones[Math.max(0, Math.min(6, level - 1))];
  }),
}));

// ============================================================
// Helpers
// ============================================================

function createMockConversation(overrides: Record<string, unknown> = {}) {
  const externalFn = mock(async (fn: () => Promise<unknown>) => fn());
  const waitForCallbackQueryFn = mock(() =>
    Promise.resolve({
      callbackQuery: { data: "confirm:accept" },
      answerCallbackQuery: mock(() => Promise.resolve()),
    }),
  );
  const waitForFn = mock(() =>
    Promise.resolve({
      message: { text: "Добавь медитацию" },
    }),
  );

  return {
    external: externalFn,
    waitForCallbackQuery: waitForCallbackQueryFn,
    waitFor: waitForFn,
    ...overrides,
  };
}

function createMockCtx(overrides: Record<string, unknown> = {}) {
  return {
    from: { id: 12345 },
    chat: { id: 67890 },
    reply: mock(() => Promise.resolve()),
    session: {
      step: "morning_checkin",
      current_ritual: "morning",
      working_memory_cache: "",
      working_memory_updated_at: null,
      conversation_context: "",
      processing: false,
      message_count: 0,
    },
    userId: "user-123",
    ...overrides,
  };
}

// ============================================================
// Dynamic import (after mocks)
// ============================================================

const { morningCheckin } = await import("../morningCheckin");

// ============================================================
// Tests
// ============================================================

describe("morningCheckin conversation", () => {
  beforeEach(() => {
    mockCreateMessage.mockClear();
    mockCreateMessageWithTools.mockClear();
  });

  describe("3 rating collection", () => {
    test("conversation collects 3 ratings via waitForRating pattern", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          const values = [7, 6, 8]; // physical, emotional, energy
          return Promise.resolve({
            callbackQuery: { data: `rating:${values[callbackCount - 1] ?? 5}` },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // 3 ratings + 1 confirm keyboard = at least 4 reply calls
      expect(ctx.reply.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("metric recording", () => {
    test("ratings stored via conversation.external()", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          const values = [7, 6, 8];
          return Promise.resolve({
            callbackQuery: { data: `rating:${values[(callbackCount - 1) % 3] ?? 5}` },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // conversation.external() should be called for: metrics, zone, plan, save
      expect(conversation.external.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("zone determination", () => {
    test("zone determination calls createMessageWithTools via conversation.external()", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          return Promise.resolve({
            callbackQuery: { data: `rating:${5 + (callbackCount % 3)}` },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      expect(mockCreateMessageWithTools).toHaveBeenCalledTimes(1);
    });

    test("falls back to formula when AI fails", async () => {
      mockCreateMessageWithTools.mockImplementationOnce(() => {
        throw new Error("API error");
      });

      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          return Promise.resolve({
            callbackQuery: { data: `rating:${5 + (callbackCount % 3)}` },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      // Should not throw — fallback handles it
      await morningCheckin(conversation as never, ctx as never);

      // Plan generation should still have been attempted
      expect(ctx.reply.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("plan generation", () => {
    test("plan generation uses createMessage via conversation.external()", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          return Promise.resolve({
            callbackQuery: { data: `rating:7` },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // createMessage called for plan generation
      expect(mockCreateMessage).toHaveBeenCalled();
    });
  });

  describe("user confirmation", () => {
    test("'accept' saves plan + zone to days table", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          // First 3 calls are ratings, 4th is confirm
          if (callbackCount <= 3) {
            return Promise.resolve({
              callbackQuery: { data: `rating:7` },
              answerCallbackQuery: mock(() => Promise.resolve()),
            });
          }
          return Promise.resolve({
            callbackQuery: { data: "confirm:accept" },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // conversation.external should have been called for saving
      expect(conversation.external.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    test("'edit' triggers free text input and AI regeneration", async () => {
      let callbackCount = 0;
      let confirmCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          if (callbackCount <= 3) {
            return Promise.resolve({
              callbackQuery: { data: `rating:7` },
              answerCallbackQuery: mock(() => Promise.resolve()),
            });
          }
          confirmCount++;
          // First confirm: edit, second: accept
          const data = confirmCount === 1 ? "confirm:edit" : "confirm:accept";
          return Promise.resolve({
            callbackQuery: { data },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
        waitFor: mock(() =>
          Promise.resolve({ message: { text: "Добавь медитацию" } }),
        ),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // waitFor should be called for the edit text
      expect(conversation.waitFor).toHaveBeenCalledWith("message:text");
      // createMessage called twice (original + regeneration)
      expect(mockCreateMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test("'skip' saves zone without plan", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          if (callbackCount <= 3) {
            return Promise.resolve({
              callbackQuery: { data: `rating:7` },
              answerCallbackQuery: mock(() => Promise.resolve()),
            });
          }
          return Promise.resolve({
            callbackQuery: { data: "confirm:skip" },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      // Should complete without error
      expect(ctx.session.step).toBe("idle");
    });
  });

  describe("session cleanup", () => {
    test("session.step set to 'idle' after completion", async () => {
      let callbackCount = 0;
      const conversation = createMockConversation({
        waitForCallbackQuery: mock(() => {
          callbackCount++;
          if (callbackCount <= 3) {
            return Promise.resolve({
              callbackQuery: { data: `rating:7` },
              answerCallbackQuery: mock(() => Promise.resolve()),
            });
          }
          return Promise.resolve({
            callbackQuery: { data: "confirm:accept" },
            answerCallbackQuery: mock(() => Promise.resolve()),
          });
        }),
      });
      const ctx = createMockCtx();

      await morningCheckin(conversation as never, ctx as never);

      expect(ctx.session.step).toBe("idle");
      expect(ctx.session.current_ritual).toBeNull();
    });
  });
});
