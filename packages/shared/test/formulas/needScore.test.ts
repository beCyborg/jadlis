import { describe, test, expect } from "bun:test";
import { calculateNeedScore } from "../../src/formulas/needScore";

describe("NeedScore formula", () => {
  test("returns correct value for equal-weight inputs", () => {
    // 3 metrics, equal weight=1/3: values [70, 80, 90]
    // weighted mean = 80, stddev ≈ 8.165, CV ≈ 0.102
    // Score = (80 - 0.15 * 10.2) * 1.0 = 80 - 1.53 = 78.47
    const result = calculateNeedScore([
      { value: 70, weight: 1 / 3 },
      { value: 80, weight: 1 / 3 },
      { value: 90, weight: 1 / 3 },
    ]);
    expect(result).toBeCloseTo(78.47, 1);
  });

  test("weighted mean differs from simple mean", () => {
    // Heavy weight on high value → higher score
    const highWeighted = calculateNeedScore([
      { value: 30, weight: 0.1 },
      { value: 90, weight: 0.9 },
    ]);
    const lowWeighted = calculateNeedScore([
      { value: 30, weight: 0.9 },
      { value: 90, weight: 0.1 },
    ]);
    expect(highWeighted).toBeGreaterThan(lowWeighted);
  });

  test("applies FloorPenalty when metric below threshold", () => {
    // One value at 10 (below 20) triggers floor penalty
    const withFloor = calculateNeedScore([
      { value: 10, weight: 1 / 3 },
      { value: 80, weight: 1 / 3 },
      { value: 90, weight: 1 / 3 },
    ]);
    const withoutFloor = calculateNeedScore([
      { value: 70, weight: 1 / 3 },
      { value: 80, weight: 1 / 3 },
      { value: 90, weight: 1 / 3 },
    ]);
    expect(withFloor).toBeLessThan(withoutFloor);
  });

  test("single metric (CV=0), no dispersion penalty", () => {
    const result = calculateNeedScore([{ value: 75, weight: 1.0 }]);
    expect(result).toBeCloseTo(75, 1);
  });

  test("returns 0 for empty array", () => {
    const result = calculateNeedScore([]);
    expect(result).toBe(0);
  });

  test("clamps result to [0, 100]", () => {
    const result = calculateNeedScore([
      { value: 100, weight: 0.5 },
      { value: 100, weight: 0.5 },
    ]);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
