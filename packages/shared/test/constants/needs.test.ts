import { describe, test, expect } from "bun:test";
import { NEEDS, FOUNDATION_NEEDS, PARALLEL_NEEDS } from "../../src/constants/needs";

describe("Need constants", () => {
  test("contains exactly 15 needs", () => {
    expect(NEEDS.length).toBe(15);
  });

  test("foundation needs are 6", () => {
    expect(FOUNDATION_NEEDS.length).toBe(6);
  });

  test("parallel needs are 9", () => {
    expect(PARALLEL_NEEDS.length).toBe(9);
  });

  test("each need has required fields: name, category, subcategory", () => {
    for (const need of NEEDS) {
      expect(need.name).toBeDefined();
      expect(need.category).toMatch(/^(foundation|parallel)$/);
      expect(need.subcategory).toBeDefined();
    }
  });

  test("bridge node needs include safety, health, orientation", () => {
    const bridgeNames = NEEDS.filter((n) => n.is_bridge_node).map((n) => n.name);
    expect(bridgeNames).toContain("safety");
    expect(bridgeNames).toContain("health");
    expect(bridgeNames).toContain("orientation");
  });
});
