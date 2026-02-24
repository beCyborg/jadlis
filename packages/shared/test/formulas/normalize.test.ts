import { describe, test, expect } from "bun:test";
import { normalizeMetric } from "../../src/formulas/normalize";

describe("normalizeMetric", () => {
  test("P1: linear scale maps min→0, max→100", () => {
    expect(normalizeMetric(0, { type: "P1", min: 0, max: 100 })).toBe(0);
    expect(normalizeMetric(50, { type: "P1", min: 0, max: 100 })).toBe(50);
    expect(normalizeMetric(100, { type: "P1", min: 0, max: 100 })).toBe(100);
  });

  test("P2: inverse scale maps min→100, max→0", () => {
    // Higher raw = lower score (e.g., stress)
    expect(normalizeMetric(1, { type: "P2", min: 1, max: 10 })).toBe(100);
    expect(normalizeMetric(10, { type: "P2", min: 1, max: 10 })).toBe(0);
  });

  test("P3: target-based scale — at target = 100", () => {
    // At target = max score
    expect(normalizeMetric(2000, { type: "P3", min: 0, max: 4000, target: 2000 })).toBe(100);
  });

  test("P3: deviation from target reduces score", () => {
    const atTarget = normalizeMetric(2000, { type: "P3", min: 0, max: 4000, target: 2000 });
    const belowTarget = normalizeMetric(1000, { type: "P3", min: 0, max: 4000, target: 2000 });
    expect(belowTarget).toBeLessThan(atTarget);
  });

  test("P4: threshold scale — above threshold = 100, below = 0", () => {
    expect(normalizeMetric(1, { type: "P4", threshold: 1 })).toBe(100);
    expect(normalizeMetric(0, { type: "P4", threshold: 1 })).toBe(0);
  });

  test("clamps values to [0, 100]", () => {
    const result = normalizeMetric(200, { type: "P1", min: 0, max: 100 });
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
