import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Mock embeddings module (embedText)
// ============================================================

const MOCK_EMBEDDING = new Array(1024).fill(0).map((_, i) => i * 0.001);
let mockEmbedTextCalls: any[] = [];

mock.module("../embeddings", () => ({
  embedText: async (text: string, options: any) => {
    mockEmbedTextCalls.push({ text, options });
    return MOCK_EMBEDDING;
  },
}));

// ============================================================
// Mock Supabase client
// ============================================================

let mockRpcArgs: any[] = [];
let mockRpcResult: any = { data: [], error: null };

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (fnName: string, params: any) => {
      mockRpcArgs.push({ fnName, params });
      return mockRpcResult;
    },
  }),
}));

// ============================================================
// Tests
// ============================================================

describe("semanticSearch()", () => {
  beforeEach(() => {
    mockEmbedTextCalls = [];
    mockRpcArgs = [];
    mockRpcResult = {
      data: [
        {
          id: "uuid-1",
          content: "matched content",
          metadata: { h1: "Test" },
          similarity: 0.95,
        },
        {
          id: "uuid-2",
          content: "another match",
          metadata: { h1: "Test2" },
          similarity: 0.85,
        },
      ],
      error: null,
    };
    process.env.VOYAGE_API_KEY = "test-key";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  });

  test("calls embedText with inputType=query", async () => {
    const { semanticSearch } = await import("../search");
    await semanticSearch("test query", { userId: "user-1" });

    expect(mockEmbedTextCalls.length).toBe(1);
    expect(mockEmbedTextCalls[0].options.inputType).toBe("query");
  });

  test("passes sourceTypes filter to search_documents RPC", async () => {
    const { semanticSearch } = await import("../search");
    await semanticSearch("test query", {
      userId: "user-1",
      sourceTypes: ["framework", "memory_fact"],
    });

    expect(mockRpcArgs.length).toBe(1);
    expect(mockRpcArgs[0].fnName).toBe("search_documents");
    expect(mockRpcArgs[0].params.p_source_types).toEqual([
      "framework",
      "memory_fact",
    ]);
  });

  test("returns results ordered by similarity score descending", async () => {
    const { semanticSearch } = await import("../search");
    const results = await semanticSearch("test query", { userId: "user-1" });

    expect(results.length).toBe(2);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });

  test("passes default limit=5 and threshold=0.7", async () => {
    const { semanticSearch } = await import("../search");
    await semanticSearch("test", { userId: "user-1" });

    expect(mockRpcArgs[0].params.p_limit).toBe(5);
    expect(mockRpcArgs[0].params.similarity_threshold).toBe(0.7);
  });

  test("allows custom limit and threshold", async () => {
    const { semanticSearch } = await import("../search");
    await semanticSearch("test", {
      userId: "user-1",
      limit: 10,
      similarityThreshold: 0.5,
    });

    expect(mockRpcArgs[0].params.p_limit).toBe(10);
    expect(mockRpcArgs[0].params.similarity_threshold).toBe(0.5);
  });

  test("passes null sourceTypes when not provided", async () => {
    const { semanticSearch } = await import("../search");
    await semanticSearch("test", { userId: "user-1" });

    expect(mockRpcArgs[0].params.p_source_types).toBeNull();
  });
});
