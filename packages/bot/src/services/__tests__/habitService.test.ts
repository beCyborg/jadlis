import { describe, test, expect, mock } from "bun:test";

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const terminal = () =>
    Promise.resolve({ data: overrides.data ?? null, error: overrides.error ?? null });

  chain.maybeSingle = mock(terminal);
  chain.single = mock(terminal);
  chain.eq = mock(() => chain);
  chain.in = mock(() => chain);
  chain.select = mock(() => chain);
  chain.insert = mock(() => chain);
  chain.update = mock(() => chain);
  chain.order = mock(terminal);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    terminal().then(resolve, reject);

  return {
    from: mock(() => chain),
    rpc: mock(() =>
      Promise.resolve({ data: overrides.rpcData ?? null, error: overrides.rpcError ?? null }),
    ),
    _chain: chain,
  };
}

// Override any mock.module from other test files (e.g. neuroCharge.test.ts)
mock.module("../../services/habitService", () => ({
  findOrCreateHabit: (...args: unknown[]) => findOrCreateHabit(...args as [never, never, never]),
  logHabitCompletion: (...args: unknown[]) => logHabitCompletion(...args as [never, never, never]),
  getTodayHabits: (...args: unknown[]) => getTodayHabits(...args as [never, never]),
  getStreakInfo: (...args: unknown[]) => getStreakInfo(...args as [never, never]),
}));

const { findOrCreateHabit, logHabitCompletion, getTodayHabits, getStreakInfo } =
  await import("../habitService");

describe("habitService", () => {
  describe("getTodayHabits", () => {
    test("returns daily active habits only", async () => {
      const habits = [
        { id: "h1", name: "Meditation", frequency: "daily", status: "active" },
        { id: "h2", name: "Exercise", frequency: "daily", status: "active" },
      ];
      const sb = createMockSupabase({ data: habits });

      const result = await getTodayHabits("user-1", sb as never);
      expect(sb.from).toHaveBeenCalledWith("habits");
      expect(result).toEqual(habits);
    });
  });

  describe("logHabitCompletion", () => {
    test("inserts completion record", async () => {
      const sb = createMockSupabase({});
      await logHabitCompletion("habit-1", "user-1", sb as never);

      expect(sb.from).toHaveBeenCalledWith("habit_completions");
    });

    test("triggers update_habit_momentum RPC with p_completed", async () => {
      const sb = createMockSupabase({});
      await logHabitCompletion("habit-1", "user-1", sb as never);

      expect(sb.rpc).toHaveBeenCalledWith("update_habit_momentum", {
        p_habit_id: "habit-1",
        p_completed: true,
      });
    });
  });

  describe("getStreakInfo", () => {
    test("returns current streak counts", async () => {
      const streakData = [
        { id: "h1", streak: 5 },
        { id: "h2", streak: 3 },
      ];
      const sb = createMockSupabase({ data: streakData });

      const result = await getStreakInfo("user-1", sb as never);
      expect(result.streaks).toEqual({ h1: 5, h2: 3 });
      expect(result.longestStreak).toBe(5);
    });
  });
});
