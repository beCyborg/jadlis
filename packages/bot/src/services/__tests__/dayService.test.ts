import { describe, test, expect, mock } from "bun:test";

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const terminal = () =>
    Promise.resolve({ data: overrides.data ?? null, error: overrides.error ?? null });

  chain.maybeSingle = mock(terminal);
  chain.single = mock(terminal);
  chain.not = mock(() => chain);
  chain.is = mock(() => chain);
  chain.eq = mock(() => chain);
  chain.in = mock(() => chain);
  chain.select = mock(() => chain);
  chain.insert = mock(() => chain);
  chain.update = mock(() => chain);
  chain.upsert = mock(() => chain);
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
// by re-declaring the module mock with all real exports
mock.module("../../services/dayService", () => ({
  getOrCreateTodayRecord: (...args: unknown[]) => getOrCreateTodayRecord(...args as [never, never]),
  updateDayField: (...args: unknown[]) => updateDayField(...args as [never, never, never, never]),
  appendHighlight: (...args: unknown[]) => appendHighlight(...args as [never, never, never]),
  isMorningCompleted: (...args: unknown[]) => isMorningCompleted(...args as [never, never]),
  isEveningCompleted: (...args: unknown[]) => isEveningCompleted(...args as [never, never]),
}));

const { getOrCreateTodayRecord, updateDayField, appendHighlight, isMorningCompleted, isEveningCompleted } =
  await import("../dayService");

describe("dayService", () => {
  describe("getOrCreateTodayRecord", () => {
    test("upserts and returns day record for today", async () => {
      const dayRecord = {
        id: "day-1",
        user_id: "user-1",
        date: "2026-02-26",
        zone: null,
        overall_score: null,
        highlights: [],
        ai_summary: null,
        created_at: "2026-02-26T00:00:00Z",
      };
      const sb = createMockSupabase({ data: dayRecord });
      const result = await getOrCreateTodayRecord("user-1", sb as never);

      expect(sb.from).toHaveBeenCalledWith("days");
      expect(result).toEqual(dayRecord);
    });

    test("returns existing record if already present", async () => {
      const existing = {
        id: "day-1",
        user_id: "user-1",
        date: "2026-02-26",
        zone: "stable",
        overall_score: 7,
        highlights: ["good day"],
        ai_summary: null,
        created_at: "2026-02-26T00:00:00Z",
      };
      const sb = createMockSupabase({ data: existing });
      const result = await getOrCreateTodayRecord("user-1", sb as never);

      expect(result).toEqual(existing);
    });
  });

  describe("updateDayField", () => {
    test("updates single field (zone)", async () => {
      const sb = createMockSupabase({});
      await updateDayField("user-1", "zone", "flow", sb as never);

      expect(sb.from).toHaveBeenCalledWith("days");
      expect(sb._chain.update).toHaveBeenCalled();
    });

    test("updates overall_score", async () => {
      const sb = createMockSupabase({});
      await updateDayField("user-1", "overall_score", 8, sb as never);

      expect(sb.from).toHaveBeenCalledWith("days");
    });
  });

  describe("appendHighlight", () => {
    test("calls RPC to append highlight", async () => {
      const sb = createMockSupabase({});
      await appendHighlight("user-1", "Great progress today", sb as never);

      expect(sb.rpc).toHaveBeenCalledWith("append_day_highlight", {
        p_user_id: "user-1",
        p_date: expect.any(String),
        p_highlight: "Great progress today",
      });
    });
  });

  describe("isMorningCompleted", () => {
    test("returns true when zone IS NOT NULL", async () => {
      const sb = createMockSupabase({ data: { zone: "stable" } });
      const result = await isMorningCompleted("user-1", sb as never);

      expect(result).toBe(true);
    });

    test("returns false when no record or zone is null", async () => {
      const sb = createMockSupabase({ data: null });
      const result = await isMorningCompleted("user-1", sb as never);

      expect(result).toBe(false);
    });
  });

  describe("isEveningCompleted", () => {
    test("returns true when overall_score IS NOT NULL", async () => {
      const sb = createMockSupabase({ data: { overall_score: 7 } });
      const result = await isEveningCompleted("user-1", sb as never);

      expect(result).toBe(true);
    });

    test("returns false when no record", async () => {
      const sb = createMockSupabase({ data: null });
      const result = await isEveningCompleted("user-1", sb as never);

      expect(result).toBe(false);
    });
  });
});
