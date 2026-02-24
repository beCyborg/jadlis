import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";

// ============================================================
// Mock fetch
// ============================================================

let fetchCalls: { url: string; options?: any }[] = [];
let mockFetchResponse: any = [];

const originalFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  fetchCalls = [];
  mockFetchResponse = [];

  globalThis.fetch = (async (url: string, options?: any) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      json: async () => mockFetchResponse,
    } as Response;
  }) as any;
});

// ============================================================
// Tests
// ============================================================

describe("jadlis-polymarket MCP — search_markets", () => {
  test("calls Gamma API with ?q= param", async () => {
    mockFetchResponse = [
      { id: "1", question: "Will AI surpass humans?", outcomePrices: "[0.75, 0.25]" },
    ];

    const { searchMarkets } = await import("../polymarket/index");
    await searchMarkets("AI", 10);

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toContain("gamma-api.polymarket.com");
    expect(fetchCalls[0].url).toContain("q=AI");
  });

  test("returns markets with id, question, and probability fields", async () => {
    mockFetchResponse = [
      { id: "1", question: "Will AI surpass humans?", outcomePrices: "[0.75, 0.25]" },
      { id: "2", question: "Will GPT-5 launch?", outcomePrices: "[0.60, 0.40]" },
    ];

    const { searchMarkets } = await import("../polymarket/index");
    const result = await searchMarkets("AI", 10);

    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBe(2);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("question");
    expect(data[0]).toHaveProperty("probability");
  });
});

describe("jadlis-polymarket MCP — get_market_probability", () => {
  test("returns probability as float between 0 and 1", async () => {
    mockFetchResponse = {
      id: "1",
      question: "Test?",
      outcomePrices: "[0.82, 0.18]",
    };

    const { getMarketProbability } = await import("../polymarket/index");
    const result = await getMarketProbability("1");

    const data = JSON.parse(result.content[0].text);
    expect(data.probability).toBeGreaterThanOrEqual(0);
    expect(data.probability).toBeLessThanOrEqual(1);
  });

  test("interprets first outcome price as YES probability", async () => {
    mockFetchResponse = {
      id: "1",
      question: "Test?",
      outcomePrices: "[0.82, 0.18]",
    };

    const { getMarketProbability } = await import("../polymarket/index");
    const result = await getMarketProbability("1");

    const data = JSON.parse(result.content[0].text);
    expect(data.probability).toBeCloseTo(0.82, 2);
  });
});

describe("jadlis-polymarket MCP — get_markets_for_topics", () => {
  test("calls search for each topic in the list", async () => {
    mockFetchResponse = [
      { id: "1", question: "Test?", outcomePrices: "[0.5, 0.5]" },
    ];

    const { getMarketsForTopics } = await import("../polymarket/index");
    await getMarketsForTopics(["AI", "crypto", "health"]);

    expect(fetchCalls.length).toBe(3);
  });

  test("returns results indexed by topic keyword", async () => {
    mockFetchResponse = [
      { id: "1", question: "Test?", outcomePrices: "[0.5, 0.5]" },
    ];

    const { getMarketsForTopics } = await import("../polymarket/index");
    const result = await getMarketsForTopics(["AI", "crypto"]);

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty("AI");
    expect(data).toHaveProperty("crypto");
  });
});
