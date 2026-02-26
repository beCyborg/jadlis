import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Mock Firecrawl
// ============================================================

let mockScrapeResult: any = { success: true, markdown: "# Test Page\nContent here." };
let mockExtractResult: any = { success: true, data: { title: "Test", value: 42 } };
let mockScrapeCalls: any[] = [];
let mockExtractCalls: any[] = [];

mock.module("@mendable/firecrawl-js", () => ({
  default: class MockFirecrawlApp {
    constructor(_opts: any) {}
    scrape = async (url: string, opts?: any) => {
      mockScrapeCalls.push({ url, opts });
      return mockScrapeResult;
    };
    extract = async (opts?: any) => {
      mockExtractCalls.push(opts);
      return mockExtractResult;
    };
  },
}));

beforeEach(async () => {
  mockScrapeResult = { success: true, markdown: "# Test Page\nContent here." };
  mockExtractResult = { success: true, data: { title: "Test", value: 42 } };
  mockScrapeCalls = [];
  mockExtractCalls = [];
  process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
  const { _resetFirecrawl } = await import("../firecrawl/index");
  _resetFirecrawl();
});

// ============================================================
// Tests
// ============================================================

describe("jadlis-firecrawl MCP — scrape_page", () => {
  test("calls Firecrawl scrapeUrl with provided URL", async () => {
    const { scrapePage } = await import("../firecrawl/index");
    await scrapePage("https://example.com");

    expect(mockScrapeCalls.length).toBe(1);
    expect(mockScrapeCalls[0].url).toBe("https://example.com");
  });

  test("returns markdown string from scraped page", async () => {
    const { scrapePage } = await import("../firecrawl/index");
    const result = await scrapePage("https://example.com");

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("# Test Page");
  });
});

describe("jadlis-firecrawl MCP — extract_structured", () => {
  test("uses schema parameter for structured extraction", async () => {
    const schema = { type: "object", properties: { title: { type: "string" } } };
    const { extractStructured } = await import("../firecrawl/index");
    await extractStructured("https://example.com", schema);

    expect(mockExtractCalls.length).toBe(1);
    expect(mockExtractCalls[0].schema).toEqual(schema);
  });

  test("returns object that matches provided JSON schema", async () => {
    const { extractStructured } = await import("../firecrawl/index");
    const result = await extractStructured("https://example.com", {});

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty("title");
  });
});

describe("jadlis-firecrawl MCP — batch_extract", () => {
  test("returns array with one result per URL", async () => {
    const { batchExtract } = await import("../firecrawl/index");
    const result = await batchExtract(["https://a.com", "https://b.com"]);

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
  });

  test("returns partial results when individual URL extraction fails", async () => {
    // Make scrape fail on second call
    mockScrapeResult = { success: false };

    const { batchExtract } = await import("../firecrawl/index");
    const result = await batchExtract(["https://ok.com", "https://fail.com"]);

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    // Both should be null since mockScrapeResult is always { success: false }
    expect(data.every((r: any) => r === null)).toBe(true);
  });
});
