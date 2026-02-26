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

const mockCreateMessage = mock(() => Promise.resolve(JSON.stringify({
  plan: "План на завтра: 1) Утренняя зарядка 2) Работа над проектом",
  tasks: [{ title: "Утренняя зарядка", priority: "medium" }],
  joyTask: { title: "Прогулка в парке", reasoning: "Пользователь любит природу" },
})));

mock.module("@jadlis/ai", () => ({
  createMessage: mockCreateMessage,
  buildTaskTransferPrompt: mock(() => "transfer prompt"),
  buildTomorrowPlanPrompt: mock(() => "tomorrow prompt"),
  buildDaySummaryPrompt: mock(() => "summary prompt"),
  buildWorkingMemory: mock(() => Promise.resolve("working memory text")),
  invalidateWorkingMemoryCache: mock(() => Promise.resolve()),
  embedText: mock(() => Promise.resolve([0.1, 0.2, 0.3])),
  shouldTriggerEpisodeSummarization: mock(() => false),
}));

/**
 * Chainable supabase mock.
 */
function createChainableSupabaseMock() {
  const defaultResult = { data: null, error: null };
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(defaultResult);
      }
      if (prop === "_calls") return calls;
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

const mockIsEveningCompleted = mock(() => Promise.resolve(false));
const mockUpdateDayField = mock(() => Promise.resolve());
const mockAppendHighlight = mock(() => Promise.resolve());
const mockGetOrCreateTodayRecord = mock(() => Promise.resolve({ id: "day-1" }));

mock.module("../../services/dayService", () => ({
  isEveningCompleted: mockIsEveningCompleted,
  updateDayField: mockUpdateDayField,
  appendHighlight: mockAppendHighlight,
  getOrCreateTodayRecord: mockGetOrCreateTodayRecord,
}));

const mockGetTodayTasks = mock(() => Promise.resolve([] as unknown[]));
const mockUpdateTaskStatus = mock(() => Promise.resolve());
const mockTransferTaskToDate = mock(() => Promise.resolve());
const mockDeferTask = mock(() => Promise.resolve());
const mockCreateTasksForDate = mock(() => Promise.resolve());

mock.module("../../services/taskService", () => ({
  getTodayTasks: mockGetTodayTasks,
  updateTaskStatus: mockUpdateTaskStatus,
  transferTaskToDate: mockTransferTaskToDate,
  deferTask: mockDeferTask,
  createTasksForDate: mockCreateTasksForDate,
}));

const mockGetTodayHabits = mock(() => Promise.resolve([] as unknown[]));
const mockLogHabitCompletion = mock(() => Promise.resolve());

mock.module("../../services/habitService", () => ({
  getTodayHabits: mockGetTodayHabits,
  logHabitCompletion: mockLogHabitCompletion,
}));

// ============================================================
// Helpers
// ============================================================

/**
 * Creates a mock conversation that processes a sequence of interactions.
 * `waitFor` calls return text messages.
 * `waitForCallbackQuery` calls return callback query responses.
 */
function createMockConversation(opts: {
  texts?: string[];
  callbacks?: Array<{ data: string }>;
} = {}) {
  const textQueue = [...(opts.texts ?? ["Прогулка по набережной", "нет"])];
  const callbackQueue = [...(opts.callbacks ?? [
    { data: "evening_score:7" },    // Step 2: rating
    { data: "skip_comment" },        // Step 2: skip comment
    // no task/habit callbacks (empty lists)
    { data: "skip_resistance" },     // Step 4: skip resistance (this goes to waitFor, not callback)
    { data: "plan:accept" },         // Step 5: accept plan
  ])];

  let textIdx = 0;
  let cbIdx = 0;

  const externalFn = mock(async (fn: () => Promise<unknown>) => fn());

  const waitForFn = mock((_filter: string | string[]) => {
    const text = textQueue[textIdx++] ?? "default text";
    // Check if this should be a callback response
    // For ["message:text", "callback_query:data"] filters, check if next callback is skip
    if (Array.isArray(_filter) && _filter.includes("callback_query:data")) {
      const nextCb = callbackQueue[cbIdx];
      if (nextCb && (nextCb.data === "skip_comment" || nextCb.data === "skip_resistance")) {
        cbIdx++;
        return Promise.resolve({
          callbackQuery: { data: nextCb.data },
          answerCallbackQuery: mock(() => Promise.resolve()),
          message: undefined,
        });
      }
    }
    return Promise.resolve({
      message: { text },
      callbackQuery: undefined,
      answerCallbackQuery: undefined,
    });
  });

  const waitForCallbackQueryFn = mock((_pattern: RegExp | string) => {
    const cb = callbackQueue[cbIdx++] ?? { data: "confirm:accept" };
    return Promise.resolve({
      callbackQuery: { data: cb.data },
      answerCallbackQuery: mock(() => Promise.resolve()),
      editMessageReplyMarkup: mock(() => Promise.resolve()),
    });
  });

  return {
    external: externalFn,
    waitFor: waitForFn,
    waitForCallbackQuery: waitForCallbackQueryFn,
  };
}

function createMockCtx(overrides: Record<string, unknown> = {}) {
  return {
    from: { id: 12345 },
    chat: { id: 67890 },
    reply: mock(() => Promise.resolve()),
    session: {
      step: "evening_scanner",
      current_ritual: "evening",
      working_memory_cache: "",
      working_memory_updated_at: null,
      conversation_context: "",
      processing: false,
      message_count: 5,
    },
    userId: "user-123",
    var: { user: { id: "user-123" } },
    ...overrides,
  };
}

function resetAllMocks() {
  mockCreateMessage.mockClear();
  mockIsEveningCompleted.mockClear();
  mockUpdateDayField.mockClear();
  mockAppendHighlight.mockClear();
  mockGetOrCreateTodayRecord.mockClear();
  mockGetTodayTasks.mockClear();
  mockUpdateTaskStatus.mockClear();
  mockTransferTaskToDate.mockClear();
  mockDeferTask.mockClear();
  mockCreateTasksForDate.mockClear();
  mockGetTodayHabits.mockClear();
  mockLogHabitCompletion.mockClear();

  // Reset defaults
  mockIsEveningCompleted.mockImplementation(() => Promise.resolve(false));
  mockGetTodayTasks.mockImplementation(() => Promise.resolve([]));
  mockGetTodayHabits.mockImplementation(() => Promise.resolve([]));

  // createMessage is called for different purposes:
  // 1st call: task transfer (returns array) — only when incomplete tasks exist
  // last call: tomorrow plan (returns object)
  let createMessageCallCount = 0;
  mockCreateMessage.mockImplementation(() => {
    createMessageCallCount++;
    // Default: return plan object (works for most tests with no tasks)
    return Promise.resolve(JSON.stringify({
      plan: "План на завтра",
      tasks: [{ title: "Задача", priority: "medium" }],
      joyTask: { title: "Радость", reasoning: "Потому что" },
    }));
  });
}

// ============================================================
// Dynamic import (after mocks)
// ============================================================

const { eveningScanner } = await import("../eveningScanner");

// ============================================================
// Tests
// ============================================================

describe("eveningScanner conversation", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("Duplicate ritual protection", () => {
    test("skips conversation if overall_score IS NOT NULL for today", async () => {
      mockIsEveningCompleted.mockImplementation(() => Promise.resolve(true));

      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      const replyTexts = ctx.reply.mock.calls.map((c: unknown[]) => c[0]);
      expect(replyTexts.some((t: string) => t.includes("уже пройден"))).toBe(true);
    });

    test("sends 'already completed' message and exits early", async () => {
      mockIsEveningCompleted.mockImplementation(() => Promise.resolve(true));

      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      // Only the duplicate check external call
      expect(conversation.external.mock.calls.length).toBe(1);
    });
  });

  describe("Step 1 — Замечательный момент", () => {
    test("collects free text via conversation.waitFor('message:text')", async () => {
      const conversation = createMockConversation({
        texts: ["Красивый закат", "нет"],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      // waitFor should have been called with "message:text" for highlight
      expect(conversation.waitFor).toHaveBeenCalledWith("message:text");
    });

    test("stores text in days.highlights via conversation.external()", async () => {
      const conversation = createMockConversation({
        texts: ["Красивый закат", "нет"],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockAppendHighlight).toHaveBeenCalled();
    });
  });

  describe("Step 2 — Оценка дня", () => {
    test("collects rating 1-10 and stores overall_score", async () => {
      const conversation = createMockConversation({
        texts: ["Красивый закат", "нет"],
        callbacks: [
          { data: "evening_score:8" },
          { data: "skip_comment" },
          { data: "skip_resistance" },
          { data: "plan:accept" },
        ],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockUpdateDayField).toHaveBeenCalled();
    });
  });

  describe("Step 3 — Task Review", () => {
    test("fetches today's tasks", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockGetTodayTasks).toHaveBeenCalled();
    });

    test("completed tasks set to status 'done' via conversation.external()", async () => {
      mockGetTodayTasks.mockImplementation(() => Promise.resolve([
        { id: "t1", title: "Задача 1", status: "pending", priority: "medium" },
        { id: "t2", title: "Задача 2", status: "pending", priority: "low" },
      ]));

      // createMessage: 1st call = task transfer (array), 2nd call = plan (object)
      let aiCallCount = 0;
      mockCreateMessage.mockImplementation(() => {
        aiCallCount++;
        if (aiCallCount === 1) {
          // Task transfer suggestions
          return Promise.resolve(JSON.stringify([
            { taskId: "t2", action: "transfer", reasoning: "Перенести на завтра" },
          ]));
        }
        // Plan
        return Promise.resolve(JSON.stringify({
          plan: "План на завтра",
          tasks: [{ title: "Задача", priority: "medium" }],
          joyTask: { title: "Радость", reasoning: "Потому что" },
        }));
      });

      // Mock: select t1, then done, then accept AI suggestion for t2
      const conversation = createMockConversation({
        texts: ["Красивый закат", "нет"],
        callbacks: [
          { data: "evening_score:7" },
          { data: "skip_comment" },
          { data: "task_select:toggle:t1" },  // toggle t1
          { data: "task_select:done" },        // confirm tasks
          // no habits (empty)
          { data: "task_action:accept:t2" },   // accept AI suggestion for t2
          { data: "skip_resistance" },
          { data: "plan:accept" },
        ],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      // t1 should be marked as done
      expect(mockUpdateTaskStatus).toHaveBeenCalled();
    });
  });

  describe("Step 3b — Habit Review", () => {
    test("fetches daily active habits", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockGetTodayHabits).toHaveBeenCalled();
    });
  });

  describe("Step 3c — Incomplete Task Actions", () => {
    test("AI call skipped when no incomplete tasks", async () => {
      mockGetTodayTasks.mockImplementation(() => Promise.resolve([]));

      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      // Only 1 createMessage call (for tomorrow plan), not for task transfer
      expect(mockCreateMessage.mock.calls.length).toBe(1);
    });
  });

  describe("Step 4 — Сопротивление", () => {
    test("'нет' input skips energy_leaks storage", async () => {
      const conversation = createMockConversation({
        texts: ["Красивый закат", "нет"],
        callbacks: [
          { data: "evening_score:7" },
          { data: "skip_comment" },
          // Step 4: resistance text "нет" comes from waitFor
          { data: "plan:accept" },
        ],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(ctx.session.step).toBe("idle");
    });

    test("skip button skips resistance", async () => {
      const conversation = createMockConversation({
        texts: ["Красивый закат"],
        callbacks: [
          { data: "evening_score:7" },
          { data: "skip_comment" },
          { data: "skip_resistance" },
          { data: "plan:accept" },
        ],
      });
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(ctx.session.step).toBe("idle");
    });
  });

  describe("Step 5 — Plan Tomorrow", () => {
    test("AI generates plan via conversation.external()", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockCreateMessage).toHaveBeenCalled();
    });

    test("plan text displayed to user before confirmation", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      const replyTexts = ctx.reply.mock.calls.map((c: unknown[]) => c[0]);
      expect(replyTexts.some((t: string) =>
        typeof t === "string" && t.includes("План на завтра"),
      )).toBe(true);
    });

    test("Принять creates task entries for tomorrow", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(mockCreateTasksForDate).toHaveBeenCalled();
    });
  });

  describe("Post-conversation actions", () => {
    test("session.step set to 'idle' after conversation ends", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(ctx.session.step).toBe("idle");
    });

    test("session.current_ritual set to null after conversation ends", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      expect(ctx.session.current_ritual).toBeNull();
    });

    test("confirmation message sent", async () => {
      const conversation = createMockConversation();
      const ctx = createMockCtx();

      await eveningScanner(conversation as never, ctx as never);

      const replyTexts = ctx.reply.mock.calls.map((c: unknown[]) => c[0]);
      expect(replyTexts.some((t: string) =>
        typeof t === "string" && t.includes("Вечерний сканер завершён"),
      )).toBe(true);
    });
  });
});
