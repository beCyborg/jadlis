import { describe, test, expect } from "bun:test";
import { calculateEWMA } from "../../src/formulas/momentum";

describe("EWMA momentum", () => {
  test("formula with α=0.3 for completion (scaled to 100)", () => {
    // M_new = 0.3 × 100 + 0.7 × 50 = 30 + 35 = 65
    const result = calculateEWMA(1, 50);
    expect(result).toBeCloseTo(65);
  });

  test("handles first value when no previous momentum (M_old = 0)", () => {
    // M_new = 0.3 × 100 + 0.7 × 0 = 30
    const result = calculateEWMA(1, 0);
    expect(result).toBeCloseTo(30);
  });

  test("missed day reduces momentum", () => {
    // X=0, M_old=80 → M_new = 0.3*0 + 0.7*80 = 56
    const result = calculateEWMA(0, 80);
    expect(result).toBeCloseTo(56);
  });

  test("converges toward 100 after many completions", () => {
    let momentum = 0;
    for (let i = 0; i < 100; i++) {
      momentum = calculateEWMA(1, momentum);
    }
    expect(momentum).toBeGreaterThan(99);
  });

  test("result is clamped to [0, 100]", () => {
    const result = calculateEWMA(1, 100);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
