import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Mock Supabase
// ============================================================

let mockQueryResult: any = { data: [], error: null };
let mockRpcResult: any = { data: true, error: null };
let mockInsertCalls: any[] = [];
let mockUpsertCalls: any[] = [];
let mockUpdateCalls: any[] = [];
let mockDeleteCalls: any[] = [];
let mockRpcCalls: any[] = [];

const mockChain = () => {
  const chain: any = {
    select: () => chain,
    insert: (rows: any) => { mockInsertCalls.push(rows); return Promise.resolve(mockQueryResult); },
    upsert: (rows: any, opts?: any) => { mockUpsertCalls.push({ rows, opts }); return Promise.resolve(mockQueryResult); },
    update: (data: any) => { mockUpdateCalls.push(data); return chain; },
    delete: () => chain,
    eq: () => chain,
    in: () => chain,
    filter: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(mockQueryResult),
    then: (resolve: any) => resolve(mockQueryResult),
  };
  return chain;
};

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => mockChain(),
    rpc: (name: string, params: any) => {
      mockRpcCalls.push({ name, params });
      return Promise.resolve(mockRpcResult);
    },
  }),
}));

// Mock @jadlis/ai for search_embeddings and write_memory_fact
mock.module("@jadlis/ai", () => ({
  embedText: async () => new Array(1024).fill(0),
  semanticSearch: async () => [
    { content: "test result", similarity: 0.95, metadata: {} },
    { content: "test result 2", similarity: 0.85, metadata: {} },
  ],
}));

mock.module("voyageai", () => ({
  VoyageAIClient: class {
    embed = async () => ({ data: [{ embedding: new Array(1024).fill(0), index: 0 }], usage: { totalTokens: 10 } });
  },
}));

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  mockQueryResult = { data: [], error: null };
  mockRpcResult = { data: true, error: null };
  mockInsertCalls = [];
  mockUpsertCalls = [];
  mockUpdateCalls = [];
  mockDeleteCalls = [];
  mockRpcCalls = [];
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-key";
  process.env.VOYAGE_API_KEY = "test-voyage-key";
});

describe("jadlis-supabase MCP — read_needs", () => {
  test("returns needs with current_score for given user_id", async () => {
    mockQueryResult = {
      data: [
        { id: "1", name: "sleep", current_score: 75, target_score: 80 },
        { id: "2", name: "nutrition", current_score: 60, target_score: 80 },
      ],
      error: null,
    };

    const { readNeeds } = await import("../supabase/index");
    const result = await readNeeds("test-user-id");

    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].current_score).toBe(75);
  });

  test("accepts user_id as required parameter", async () => {
    const { readNeeds } = await import("../supabase/index");
    const result = await readNeeds("specific-user-id");
    expect(result.content).toBeDefined();
  });
});

describe("jadlis-supabase MCP — log_metric_value", () => {
  test("defaults source to 'manual' when omitted", async () => {
    mockQueryResult = { data: null, error: null };
    const { logMetricValue } = await import("../supabase/index");
    await logMetricValue("user-1", "metric-1", 85);

    expect(mockInsertCalls.length).toBeGreaterThanOrEqual(1);
    const inserted = mockInsertCalls[0];
    expect(inserted.source).toBe("manual");
  });

  test("rejects non-numeric value", async () => {
    const { logMetricValue } = await import("../supabase/index");
    const result = await logMetricValue("user-1", "metric-1", NaN);

    expect(result.isError).toBe(true);
  });
});

describe("jadlis-supabase MCP — log_habit_completion", () => {
  test("inserts completion record with correct habit_id and user_id", async () => {
    mockQueryResult = { data: null, error: null };
    const { logHabitCompletion } = await import("../supabase/index");
    await logHabitCompletion("user-1", "habit-1");

    expect(mockInsertCalls.length).toBeGreaterThanOrEqual(1);
    const inserted = mockInsertCalls[0];
    expect(inserted.user_id).toBe("user-1");
    expect(inserted.habit_id).toBe("habit-1");
  });

  test("calls update_habit_momentum after inserting completion", async () => {
    mockQueryResult = { data: null, error: null };
    const { logHabitCompletion } = await import("../supabase/index");
    await logHabitCompletion("user-1", "habit-1");

    const momentumCall = mockRpcCalls.find((c) => c.name === "update_habit_momentum");
    expect(momentumCall).toBeDefined();
  });
});

describe("jadlis-supabase MCP — write_memory_fact", () => {
  test("upserts memory_facts by key", async () => {
    mockQueryResult = { data: null, error: null };
    const { writeMemoryFact } = await import("../supabase/index");
    await writeMemoryFact("user-1", "pref_lang", "русский", "preference");

    expect(mockUpsertCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("updates jadlis_documents with source_type=memory_fact", async () => {
    mockQueryResult = { data: null, error: null };
    mockUpsertCalls = [];
    const { writeMemoryFact } = await import("../supabase/index");
    await writeMemoryFact("user-1", "pref_lang", "русский", "preference");

    // Should have 2 upserts: memory_facts + jadlis_documents
    expect(mockUpsertCalls.length).toBeGreaterThanOrEqual(2);
    const docUpsert = mockUpsertCalls.find((c: any) => c.rows.source_type === "memory_fact");
    expect(docUpsert).toBeDefined();
    expect(docUpsert.rows.content).toBe("русский");
    expect(docUpsert.rows.embedding).toHaveLength(1024);
  });
});

describe("jadlis-supabase MCP — search_embeddings", () => {
  test("passes sourceTypes to semantic search", async () => {
    const { searchEmbeddings } = await import("../supabase/index");
    const result = await searchEmbeddings("user-1", "test query", ["memory_fact", "memory_episode"]);

    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
  });

  test("results are ordered by similarity desc", async () => {
    const { searchEmbeddings } = await import("../supabase/index");
    const result = await searchEmbeddings("user-1", "test query");

    const data = JSON.parse(result.content[0].text);
    if (data.length >= 2) {
      expect(data[0].similarity).toBeGreaterThanOrEqual(data[1].similarity);
    }
  });
});

describe("jadlis-supabase MCP — read_tasks", () => {
  test("filters tasks by status when status param provided", async () => {
    mockQueryResult = {
      data: [{ id: "1", title: "Test task", status: "pending" }],
      error: null,
    };
    const { readTasks } = await import("../supabase/index");
    const result = await readTasks("user-1", "pending");

    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(data[0].status).toBe("pending");
  });
});
