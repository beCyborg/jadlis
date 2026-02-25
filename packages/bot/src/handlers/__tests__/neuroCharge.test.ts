import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mocks (before dynamic imports) ---

const mockCancelReminders = mock(() => Promise.resolve());
const mockScheduleReminders = mock(() => Promise.resolve());
mock.module("../../queue/reminders", () => ({
  cancelReminders: mockCancelReminders,
  scheduleReminders: mockScheduleReminders,
}));

const mockIsMorningCompleted = mock(() => Promise.resolve(false));
mock.module("../../services/dayService", () => ({
  isMorningCompleted: mockIsMorningCompleted,
}));

const mockFindOrCreateHabit = mock(() => Promise.resolve("habit-id-123"));
const mockLogHabitCompletion = mock(() => Promise.resolve());
mock.module("../../services/habitService", () => ({
  findOrCreateHabit: mockFindOrCreateHabit,
  logHabitCompletion: mockLogHabitCompletion,
}));

mock.module("../../db", () => ({
  supabase: {},
}));

// --- Helpers ---

function makeCallbackCtx(data: string, overrides: Record<string, unknown> = {}) {
  return {
    callbackQuery: { data },
    answerCallbackQuery: mock(() => Promise.resolve()),
    reply: mock(() => Promise.resolve()),
    from: { id: 12345 },
    userId: "user-uuid-123",
    conversation: { enter: mock(() => Promise.resolve()) },
    ...overrides,
  };
}

// --- Tests ---

describe("neuroCharge handler", () => {
  let handleDone: (ctx: ReturnType<typeof makeCallbackCtx>) => Promise<void>;
  let handleSkip: (ctx: ReturnType<typeof makeCallbackCtx>) => Promise<void>;

  beforeEach(async () => {
    mockCancelReminders.mockClear();
    mockIsMorningCompleted.mockClear();
    mockFindOrCreateHabit.mockClear();
    mockLogHabitCompletion.mockClear();
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(false));

    // Dynamic import to pick up mocks
    const mod = await import("../neuroCharge");

    // Extract handlers via a mock bot
    const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
    const mockBot = {
      callbackQuery: (query: string, handler: (ctx: unknown) => Promise<void>) => {
        handlers[query] = handler;
      },
    };
    mod.registerNeuroChargeHandlers(mockBot as never);
    handleDone = handlers["neuro_charge:done"] as typeof handleDone;
    handleSkip = handlers["neuro_charge:skip"] as typeof handleSkip;
  });

  // --- done handler ---

  test("done: logs habit completion for НейроЗарядка habit", async () => {
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(mockFindOrCreateHabit).toHaveBeenCalledTimes(1);
    expect(mockLogHabitCompletion).toHaveBeenCalledWith("habit-id-123", "user-uuid-123", {});
  });

  test("done: cancels pending reminders", async () => {
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(mockCancelReminders).toHaveBeenCalledWith(12345, "neuro-charge");
  });

  test("done: enters morningCheckin conversation", async () => {
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(ctx.conversation.enter).toHaveBeenCalledWith("morningCheckin");
  });

  test("done: answers callback query first", async () => {
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
  });

  // --- skip handler ---

  test("skip: cancels pending reminders", async () => {
    const ctx = makeCallbackCtx("neuro_charge:skip");
    await handleSkip(ctx);

    expect(mockCancelReminders).toHaveBeenCalledWith(12345, "neuro-charge");
  });

  test("skip: enters morningCheckin conversation without habit log", async () => {
    const ctx = makeCallbackCtx("neuro_charge:skip");
    await handleSkip(ctx);

    expect(ctx.conversation.enter).toHaveBeenCalledWith("morningCheckin");
    expect(mockFindOrCreateHabit).not.toHaveBeenCalled();
    expect(mockLogHabitCompletion).not.toHaveBeenCalled();
  });

  // --- duplicate protection ---

  test("done: skips when morning already completed", async () => {
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(true));
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(ctx.conversation.enter).not.toHaveBeenCalled();
    expect(mockFindOrCreateHabit).not.toHaveBeenCalled();
  });

  test("done: sends already-completed message when zone exists", async () => {
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(true));
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Утренний чек-ин уже пройден сегодня ✓");
  });

  test("done: creates habit on first run", async () => {
    const ctx = makeCallbackCtx("neuro_charge:done");
    await handleDone(ctx);

    expect(mockFindOrCreateHabit).toHaveBeenCalledWith(
      "user-uuid-123",
      "НейроЗарядка",
      {},
    );
  });

  test("skip: sends already-completed message when morning done", async () => {
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(true));
    const ctx = makeCallbackCtx("neuro_charge:skip");
    await handleSkip(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Утренний чек-ин уже пройден сегодня ✓");
    expect(ctx.conversation.enter).not.toHaveBeenCalled();
    expect(mockCancelReminders).not.toHaveBeenCalled();
  });
});
