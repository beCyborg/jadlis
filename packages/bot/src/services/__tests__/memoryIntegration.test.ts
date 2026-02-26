import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  METRIC_CODES,
  recordMorningMetric,
  updateWorkingMemoryAfterMorning,
  runPostEveningActions,
  _setAiModuleForTest,
  _resetAiModule,
} from "../memoryIntegration";

// Mock @jadlis/shared (normalizeMetric)
mock.module("@jadlis/shared", () => ({
  normalizeMetric: mock((_val: number, _config: unknown) => 75),
}));

// Mock AI functions (via DI, not mock.module for @jadlis/ai)
const mockEmbedText = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
const mockInvalidateCache = mock(() => Promise.resolve());
const mockShouldTrigger = mock(() => false);
const mockSummarize = mock(() => Promise.resolve());

function createMockAiModule() {
  return {
    embedText: mockEmbedText,
    invalidateWorkingMemoryCache: mockInvalidateCache,
    shouldTriggerEpisodeSummarization: mockShouldTrigger,
    summarizeAndStoreEpisode: mockSummarize,
  };
}

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const terminal = () =>
    Promise.resolve({ data: overrides.data ?? null, error: overrides.error ?? null });

  chain.maybeSingle = mock(terminal);
  chain.single = mock(terminal);
  chain.eq = mock(() => chain);
  chain.select = mock(() => chain);
  chain.insert = mock(() => terminal());
  chain.order = mock(() => chain);
  chain.limit = mock(() => chain);

  return {
    from: mock(() => chain),
    _chain: chain,
  };
}

describe("memoryIntegration", () => {
  beforeEach(() => {
    mockEmbedText.mockClear();
    mockInvalidateCache.mockClear();
    mockShouldTrigger.mockClear();
    mockSummarize.mockClear();
    _resetAiModule();
    _setAiModuleForTest(createMockAiModule());
  });

  describe("METRIC_CODES", () => {
    test("contains H01, H02, H03", () => {
      expect(METRIC_CODES.physical).toBe("H01");
      expect(METRIC_CODES.emotional).toBe("H02");
      expect(METRIC_CODES.energy).toBe("H03");
    });
  });

  describe("recordMorningMetric", () => {
    test("looks up metric by code and inserts normalized value", async () => {
      const metric = { id: "m-1", scale_type: "P1", scale_min: 1, scale_max: 10 };
      const sb = createMockSupabase({ data: metric });

      await recordMorningMetric("user-1", "H01", 7, sb as never);
      expect(sb.from).toHaveBeenCalledWith("metrics");
    });

    test("warns and returns when metric not found", async () => {
      const sb = createMockSupabase({ data: null });
      // Should not throw
      await recordMorningMetric("user-1", "H99", 5, sb as never);
    });
  });

  describe("updateWorkingMemoryAfterMorning", () => {
    test("invalidates working memory cache", async () => {
      await updateWorkingMemoryAfterMorning("user-1", "stable", "plan text");
      expect(mockInvalidateCache).toHaveBeenCalledWith("user-1");
    });
  });

  describe("runPostEveningActions", () => {
    test("embeds highlights and invalidates cache", async () => {
      const sb = createMockSupabase({});
      await runPostEveningActions("user-1", "Great day today!", "нет", sb as never);

      expect(mockEmbedText).toHaveBeenCalledTimes(1);
      expect(mockInvalidateCache).toHaveBeenCalledWith("user-1");
    });

    test("embeds resistance when significant", async () => {
      const sb = createMockSupabase({});
      await runPostEveningActions(
        "user-1",
        "highlights",
        "Сильное сопротивление при работе над задачей X, не мог сосредоточиться",
        sb as never,
      );

      // highlights + resistance = 2 embed calls
      expect(mockEmbedText).toHaveBeenCalledTimes(2);
    });

    test("skips resistance when trivial", async () => {
      const sb = createMockSupabase({});
      await runPostEveningActions("user-1", "highlights", "нет", sb as never);

      // Only highlights
      expect(mockEmbedText).toHaveBeenCalledTimes(1);
    });

    test("checks episode summarization threshold", async () => {
      const sb = createMockSupabase({});
      // Override select to return count for bot_sessions
      const chain = (sb as any)._chain;
      chain.select = mock(() => {
        // Return a chain that resolves with count
        return {
          eq: mock(() => Promise.resolve({ count: 10, data: null, error: null })),
        };
      });
      await runPostEveningActions("user-1", "highlights", "нет", sb as never);

      // shouldTriggerEpisodeSummarization is called with count (number), not userId
      expect(mockShouldTrigger).toHaveBeenCalled();
    });
  });
});
