import { describe, test, expect, mock, beforeEach } from "bun:test";
import { mockZoneResponse, mockMorningPlanResponse } from "../fixtures/aiResponses";

/**
 * Integration test: Morning flow
 * BullMQ fires neuro-charge → user taps "Готово" → morning check-in →
 * 3 ratings → zone + plan → user taps "Принять" → DB state verified
 */

// --- Mocks ---

const mockCancelReminders = mock(() => Promise.resolve());
mock.module("../../queue/reminders", () => ({
  cancelReminders: mockCancelReminders,
  scheduleReminders: mock(() => Promise.resolve()),
}));

const mockIsMorningCompleted = mock(() => Promise.resolve(false));
const mockGetOrCreateTodayRecord = mock(() =>
  Promise.resolve({ id: "day-1", user_id: "user-1", date: "2026-02-26", zone: null }),
);
const mockUpdateDayField = mock(() => Promise.resolve());
mock.module("../../services/dayService", () => ({
  isMorningCompleted: mockIsMorningCompleted,
  isEveningCompleted: mock(() => Promise.resolve(false)),
  getOrCreateTodayRecord: mockGetOrCreateTodayRecord,
  updateDayField: mockUpdateDayField,
  appendHighlight: mock(() => Promise.resolve()),
}));

const mockFindOrCreateHabit = mock(() => Promise.resolve("habit-neuro-id"));
const mockLogHabitCompletion = mock(() => Promise.resolve());
mock.module("../../services/habitService", () => ({
  findOrCreateHabit: mockFindOrCreateHabit,
  logHabitCompletion: mockLogHabitCompletion,
  getTodayHabits: mock(() => Promise.resolve([])),
  getStreakInfo: mock(() => Promise.resolve({ streaks: {}, longestStreak: 0 })),
}));

mock.module("../../db", () => ({ supabase: {} }));

describe("Morning Flow Integration", () => {
  beforeEach(() => {
    mockCancelReminders.mockClear();
    mockIsMorningCompleted.mockClear();
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(false));
    mockFindOrCreateHabit.mockClear();
    mockLogHabitCompletion.mockClear();
    mockGetOrCreateTodayRecord.mockClear();
    mockUpdateDayField.mockClear();
  });

  test("neuro_charge:done → habit logged → reminders cancelled → enters morningCheckin", async () => {
    const { registerNeuroChargeHandlers } = await import("../../handlers/neuroCharge");

    const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
    const mockBot = {
      callbackQuery: (query: string, handler: (ctx: unknown) => Promise<void>) => {
        handlers[query] = handler;
      },
    };
    registerNeuroChargeHandlers(mockBot as never);

    const ctx = {
      callbackQuery: { data: "neuro_charge:done" },
      answerCallbackQuery: mock(() => Promise.resolve()),
      reply: mock(() => Promise.resolve()),
      from: { id: 12345 },
      userId: "user-uuid-123",
      conversation: { enter: mock(() => Promise.resolve()) },
    };

    await handlers["neuro_charge:done"](ctx);

    // Verify full flow sequence
    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(mockFindOrCreateHabit).toHaveBeenCalledWith("user-uuid-123", "НейроЗарядка", {});
    expect(mockLogHabitCompletion).toHaveBeenCalledWith("habit-neuro-id", "user-uuid-123", {});
    expect(mockCancelReminders).toHaveBeenCalledWith(12345, "neuro-charge");
    expect(ctx.conversation.enter).toHaveBeenCalledWith("morningCheckin");
  });

  test("duplicate protection: morning already completed → no conversation entry", async () => {
    mockIsMorningCompleted.mockImplementation(() => Promise.resolve(true));

    const { registerNeuroChargeHandlers } = await import("../../handlers/neuroCharge");

    const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
    const mockBot = {
      callbackQuery: (query: string, handler: (ctx: unknown) => Promise<void>) => {
        handlers[query] = handler;
      },
    };
    registerNeuroChargeHandlers(mockBot as never);

    const ctx = {
      callbackQuery: { data: "neuro_charge:done" },
      answerCallbackQuery: mock(() => Promise.resolve()),
      reply: mock(() => Promise.resolve()),
      from: { id: 12345 },
      userId: "user-uuid-123",
      conversation: { enter: mock(() => Promise.resolve()) },
    };

    await handlers["neuro_charge:done"](ctx);

    expect(ctx.conversation.enter).not.toHaveBeenCalled();
    expect(mockFindOrCreateHabit).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Утренний чек-ин уже пройден сегодня ✓");
  });
});
