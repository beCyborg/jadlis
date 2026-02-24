import { describe, test, expect } from "bun:test";
import { METRIC_CODES, ALL_METRICS } from "../../src/constants/metrics";
import { NEED_NAMES } from "../../src/constants/needs";

describe("Metric constants", () => {
  test("contains exactly 93 metrics", () => {
    expect(ALL_METRICS.length).toBe(93);
  });

  test("metric codes are unique across all metrics", () => {
    const codes = ALL_METRICS.map((m) => m.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  test("each metric has a non-empty code", () => {
    for (const metric of ALL_METRICS) {
      expect(metric.code.length).toBeGreaterThan(0);
    }
  });

  test("each metric references a valid need name", () => {
    const validNeeds = new Set(NEED_NAMES);
    for (const metric of ALL_METRICS) {
      expect(validNeeds.has(metric.need_name)).toBe(true);
    }
  });

  test("METRIC_CODES map has same size as ALL_METRICS", () => {
    expect(METRIC_CODES.size).toBe(ALL_METRICS.length);
  });

  test("weights per need sum to 1.0", () => {
    const weightsByNeed = new Map<string, number>();
    for (const m of ALL_METRICS) {
      const current = weightsByNeed.get(m.need_name) ?? 0;
      weightsByNeed.set(m.need_name, current + m.weight);
    }
    for (const [need, total] of weightsByNeed) {
      expect(total).toBeCloseTo(1.0, 1);
    }
  });

  test("P3 metrics have scale_target defined", () => {
    const p3Metrics = ALL_METRICS.filter((m) => m.scale_type === "P3");
    for (const m of p3Metrics) {
      expect(m.scale_target).toBeDefined();
    }
  });

  test("every need has at least one metric", () => {
    const needsWithMetrics = new Set(ALL_METRICS.map((m) => m.need_name));
    for (const name of NEED_NAMES) {
      expect(needsWithMetrics.has(name)).toBe(true);
    }
  });
});
