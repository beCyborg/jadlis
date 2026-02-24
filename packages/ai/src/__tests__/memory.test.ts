import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Mock tracking state
// ============================================================

const MOCK_EMBEDDING = new Array(1024).fill(0).map((_, i) => i * 0.001);
let mockEmbedTextCalls: any[] = [];
let mockSemanticSearchCalls: any[] = [];
let mockSemanticSearchResult: any[] = [];
let mockAnthropicCalls: any[] = [];
let mockAnthropicResponse: any = {
  content: [{ type: "text", text: "Краткое резюме беседы." }],
};

// Supabase query tracking
let supabaseOps: any[] = [];
let supabaseResults: Record<string, any> = {};

// ============================================================
// Mock embeddings module
// ============================================================

mock.module("../embeddings", () => ({
  embedText: async (text: string, options: any) => {
    mockEmbedTextCalls.push({ text, options });
    return MOCK_EMBEDDING;
  },
}));

// ============================================================
// Mock search module
// ============================================================

mock.module("../search", () => ({
  semanticSearch: async (query: string, options: any) => {
    mockSemanticSearchCalls.push({ query, options });
    return mockSemanticSearchResult;
  },
}));

// ============================================================
// Mock Anthropic SDK
// ============================================================

mock.module("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (params: any) => {
        mockAnthropicCalls.push(params);
        return mockAnthropicResponse;
      },
    };
  },
}));

// ============================================================
// Mock Supabase client
// ============================================================

function createChainableMock(tableName: string, operation: string) {
  const chain: any = {
    _table: tableName,
    _operation: operation,
    _filters: {} as Record<string, any>,
    _options: {} as Record<string, any>,
  };

  const resolveResult = () => {
    supabaseOps.push({
      table: chain._table,
      operation: chain._operation,
      filters: { ...chain._filters },
      options: { ...chain._options },
    });

    const key = `${chain._table}:${chain._operation}`;
    if (supabaseResults[key]) {
      return Promise.resolve(supabaseResults[key]);
    }
    return Promise.resolve({ data: null, error: null });
  };

  chain.eq = (col: string, val: any) => {
    chain._filters[col] = val;
    return chain;
  };
  chain.in = (col: string, vals: any[]) => {
    chain._filters[`${col}__in`] = vals;
    return chain;
  };
  chain.filter = (col: string, op: string, val: any) => {
    chain._filters[`${col}__${op}`] = val;
    return chain;
  };
  chain.match = (filters: any) => {
    Object.assign(chain._filters, filters);
    return chain;
  };
  chain.order = (col: string, opts?: any) => {
    chain._options.order = { col, ...opts };
    return chain;
  };
  chain.limit = (n: number) => {
    chain._options.limit = n;
    return chain;
  };
  chain.single = () => resolveResult();
  chain.then = (resolve: any, reject: any) => resolveResult().then(resolve, reject);

  return chain;
}

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: (cols?: string) => createChainableMock(table, `select:${cols ?? "*"}`),
      upsert: async (data: any, opts?: any) => {
        supabaseOps.push({ table, operation: "upsert", data, opts });
        const key = `${table}:upsert`;
        return supabaseResults[key] ?? { data: null, error: null };
      },
      insert: async (data: any) => {
        supabaseOps.push({ table, operation: "insert", data });
        const key = `${table}:insert`;
        return supabaseResults[key] ?? { data: null, error: null };
      },
      delete: () => createChainableMock(table, "delete"),
      update: (data: any) => {
        const chain = createChainableMock(table, "update");
        chain._data = data;
        return chain;
      },
    }),
  }),
}));

// ============================================================
// Test setup
// ============================================================

beforeEach(() => {
  mockEmbedTextCalls = [];
  mockSemanticSearchCalls = [];
  mockSemanticSearchResult = [];
  mockAnthropicCalls = [];
  mockAnthropicResponse = {
    content: [{ type: "text", text: "Краткое резюме беседы." }],
  };
  supabaseOps = [];
  supabaseResults = {};
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.VOYAGE_API_KEY = "test-voyage-key";
});

// ============================================================
// Level 1: Long-term memory (memory_facts)
// ============================================================

describe("readFacts()", () => {
  test("returns all facts for userId without category filter", async () => {
    const mockFacts = [
      { id: "1", user_id: "user-1", category: "preference" as const, key: "sleep", value: "8 hours", confidence: 1, source: "user_stated" as const, last_accessed: new Date(), created_at: new Date() },
      { id: "2", user_id: "user-1", category: "context" as const, key: "city", value: "Tbilisi", confidence: 0.9, source: "inferred" as const, last_accessed: new Date(), created_at: new Date() },
    ];
    supabaseResults["memory_facts:select:*"] = { data: mockFacts, error: null };

    const { readFacts } = await import("../memory");
    const facts = await readFacts("user-1");

    expect(facts).toEqual(mockFacts);
    const op = supabaseOps.find((o) => o.table === "memory_facts" && o.operation.startsWith("select"));
    expect(op).toBeDefined();
    expect(op!.filters.user_id).toBe("user-1");
  });

  test("filters results by category when category param is provided", async () => {
    const mockFacts = [
      { id: "1", user_id: "user-1", category: "preference", key: "sleep", value: "8 hours", confidence: 1, source: "user_stated" },
    ];
    supabaseResults["memory_facts:select:*"] = { data: mockFacts, error: null };

    const { readFacts } = await import("../memory");
    const facts = await readFacts("user-1", "preference");

    const op = supabaseOps.find((o) => o.table === "memory_facts" && o.operation.startsWith("select"));
    expect(op!.filters.category).toBe("preference");
  });

  test("returns empty array when no facts exist for user", async () => {
    supabaseResults["memory_facts:select:*"] = { data: [], error: null };

    const { readFacts } = await import("../memory");
    const facts = await readFacts("user-nonexistent");

    expect(facts).toEqual([]);
  });
});

describe("writeFact()", () => {
  test("inserts a new fact when key does not exist", async () => {
    const { writeFact } = await import("../memory");
    await writeFact("user-1", "sleep_preference", "8 hours");

    const upsertOp = supabaseOps.find((o) => o.table === "memory_facts" && o.operation === "upsert");
    expect(upsertOp).toBeDefined();
    expect(upsertOp!.data.user_id).toBe("user-1");
    expect(upsertOp!.data.key).toBe("sleep_preference");
    expect(upsertOp!.data.value).toBe("8 hours");
  });

  test("updates value when fact with same key already exists", async () => {
    const { writeFact } = await import("../memory");
    await writeFact("user-1", "sleep_preference", "7 hours", { category: "preference" });

    const upsertOp = supabaseOps.find((o) => o.table === "memory_facts" && o.operation === "upsert");
    expect(upsertOp).toBeDefined();
    expect(upsertOp!.opts?.onConflict).toBe("user_id,key");
  });

  test("calls embedText and inserts jadlis_documents with source_type=memory_fact", async () => {
    const { writeFact } = await import("../memory");
    await writeFact("user-1", "city", "Tbilisi", { category: "context" });

    // Should have called embedText
    expect(mockEmbedTextCalls.length).toBeGreaterThanOrEqual(1);
    const embedCall = mockEmbedTextCalls.find((c) => c.text.includes("city") && c.text.includes("Tbilisi"));
    expect(embedCall).toBeDefined();
    expect(embedCall!.options.inputType).toBe("document");

    // Should delete existing vector then insert new one (delete+insert strategy)
    const deleteDocOp = supabaseOps.find((o) => o.table === "jadlis_documents" && o.operation === "delete");
    expect(deleteDocOp).toBeDefined();

    const insertDocOp = supabaseOps.find((o) => o.table === "jadlis_documents" && o.operation === "insert");
    expect(insertDocOp).toBeDefined();
    expect(insertDocOp!.data.source_type).toBe("memory_fact");
    expect(insertDocOp!.data.user_id).toBe("user-1");
  });

  test("uses default values for optional parameters", async () => {
    const { writeFact } = await import("../memory");
    await writeFact("user-1", "test_key", "test_value");

    const upsertOp = supabaseOps.find((o) => o.table === "memory_facts" && o.operation === "upsert");
    expect(upsertOp!.data.category).toBe("context");
    expect(upsertOp!.data.confidence).toBe(1.0);
    expect(upsertOp!.data.source).toBe("inferred");
  });
});

describe("deleteFact()", () => {
  test("deletes from memory_facts", async () => {
    const { deleteFact } = await import("../memory");
    await deleteFact("user-1", "old_key");

    const deleteOp = supabaseOps.find((o) => o.table === "memory_facts" && o.operation === "delete");
    expect(deleteOp).toBeDefined();
    expect(deleteOp!.filters.user_id).toBe("user-1");
    expect(deleteOp!.filters.key).toBe("old_key");
  });

  test("deletes from jadlis_documents filtered by metadata factKey", async () => {
    const { deleteFact } = await import("../memory");
    await deleteFact("user-1", "old_key");

    const deleteDocOp = supabaseOps.find((o) => o.table === "jadlis_documents" && o.operation === "delete");
    expect(deleteDocOp).toBeDefined();
    expect(deleteDocOp!.filters.user_id).toBe("user-1");
    expect(deleteDocOp!.filters.source_type).toBe("memory_fact");
    // Verify metadata filter is applied (metadata->>factKey eq old_key)
    expect(deleteDocOp!.filters["metadata->>factKey__eq"]).toBe("old_key");
  });
});

// ============================================================
// Level 2: Working memory
// ============================================================

describe("buildWorkingMemory()", () => {
  test("returns formatted string with goals, habits, insights", async () => {
    // Mock session with no cache
    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: {
          step: "idle",
          working_memory_cache: null,
          working_memory_updated_at: null,
          message_count: 0,
        },
      },
      error: null,
    };

    // Mock goals query
    supabaseResults["goals:select:*"] = {
      data: [
        { title: "MVP Jadlis", progress: 40, target_date: "2026-03-01", status: "active" },
      ],
      error: null,
    };

    // Mock habits query
    supabaseResults["habits:select:*"] = {
      data: [
        { name: "Медитация", momentum: 82, streak: 7 },
      ],
      error: null,
    };

    // Mock recent facts
    supabaseResults["memory_facts:select:*"] = {
      data: [
        { key: "energy_level", value: "Высокий утром", category: "context" },
      ],
      error: null,
    };

    const { buildWorkingMemory } = await import("../memory");
    const result = await buildWorkingMemory("user-1", "chat-123");

    expect(result).toContain("MVP Jadlis");
    expect(result).toContain("Медитация");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("includes at most 3 active goals", async () => {
    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: { working_memory_cache: null, working_memory_updated_at: null },
      },
      error: null,
    };

    supabaseResults["goals:select:*"] = {
      data: [
        { title: "Goal 1", progress: 10, status: "active" },
        { title: "Goal 2", progress: 20, status: "active" },
        { title: "Goal 3", progress: 30, status: "active" },
        { title: "Goal 4", progress: 40, status: "active" },
      ],
      error: null,
    };
    supabaseResults["habits:select:*"] = { data: [], error: null };
    supabaseResults["memory_facts:select:*"] = { data: [], error: null };

    const { buildWorkingMemory } = await import("../memory");
    const result = await buildWorkingMemory("user-1", "chat-123");

    // Should contain at most 3 goals
    const goalLines = result.split("\n").filter((l: string) => l.match(/^\d+\./));
    expect(goalLines.length).toBeLessThanOrEqual(3);
  });

  test("returns cached value when working_memory_updated_at is within 1 hour", async () => {
    const cached = "=== Cached working memory ===";
    const recentTimestamp = Date.now() - 30 * 60 * 1000; // 30 min ago

    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: {
          working_memory_cache: cached,
          working_memory_updated_at: recentTimestamp,
        },
      },
      error: null,
    };

    const { buildWorkingMemory } = await import("../memory");
    const result = await buildWorkingMemory("user-1", "chat-123");

    expect(result).toBe(cached);
    // Should NOT query goals/habits since cache is fresh
    const goalsOp = supabaseOps.find((o) => o.table === "goals");
    expect(goalsOp).toBeUndefined();
  });

  test("rebuilds and updates cache when working_memory_updated_at is older than 1 hour", async () => {
    const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: {
          working_memory_cache: "old cache",
          working_memory_updated_at: staleTimestamp,
        },
      },
      error: null,
    };
    supabaseResults["goals:select:*"] = {
      data: [{ title: "Fresh Goal", progress: 50, status: "active" }],
      error: null,
    };
    supabaseResults["habits:select:*"] = { data: [], error: null };
    supabaseResults["memory_facts:select:*"] = { data: [], error: null };

    const { buildWorkingMemory } = await import("../memory");
    const result = await buildWorkingMemory("user-1", "chat-123");

    expect(result).toContain("Fresh Goal");
    expect(result).not.toBe("old cache");
  });

  test("persists rebuilt working memory to bot_sessions cache", async () => {
    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: { working_memory_cache: null, working_memory_updated_at: null },
      },
      error: null,
    };
    supabaseResults["goals:select:*"] = { data: [], error: null };
    supabaseResults["habits:select:*"] = { data: [], error: null };
    supabaseResults["memory_facts:select:*"] = { data: [], error: null };

    const { buildWorkingMemory } = await import("../memory");
    await buildWorkingMemory("user-1", "chat-123");

    const upsertOp = supabaseOps.find((o) => o.table === "bot_sessions" && o.operation === "upsert");
    expect(upsertOp).toBeDefined();
    expect(upsertOp!.data.key).toBe("chat-123");
    expect(upsertOp!.data.value.working_memory_cache).toBeDefined();
    expect(upsertOp!.data.value.working_memory_updated_at).toBeDefined();
  });
});

describe("invalidateWorkingMemoryCache()", () => {
  test("sets working_memory_updated_at to null in bot_sessions", async () => {
    supabaseResults["bot_sessions:select:value"] = {
      data: {
        value: {
          step: "idle",
          working_memory_cache: "cached",
          working_memory_updated_at: Date.now(),
          message_count: 5,
        },
      },
      error: null,
    };

    const { invalidateWorkingMemoryCache } = await import("../memory");
    await invalidateWorkingMemoryCache("chat-123");

    const upsertOp = supabaseOps.find((o) => o.table === "bot_sessions" && o.operation === "upsert");
    expect(upsertOp).toBeDefined();
    expect(upsertOp!.data.value.working_memory_updated_at).toBeNull();
  });
});

// ============================================================
// Level 3: Episodic memory
// ============================================================

describe("summarizeAndStoreEpisode()", () => {
  test("calls Claude API with the last messages to generate summary", async () => {
    const messages = [
      { role: "user" as const, content: "Привет!" },
      { role: "assistant" as const, content: "Здравствуй!" },
    ];

    const { summarizeAndStoreEpisode } = await import("../memory");
    await summarizeAndStoreEpisode("user-1", messages, { chatId: "chat-1", messageCount: 10 });

    expect(mockAnthropicCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockAnthropicCalls[0].max_tokens).toBe(500);
  });

  test("embeds summary and inserts into jadlis_documents with source_type=memory_episode", async () => {
    const messages = [
      { role: "user" as const, content: "Как дела?" },
      { role: "assistant" as const, content: "Отлично!" },
    ];

    const { summarizeAndStoreEpisode } = await import("../memory");
    await summarizeAndStoreEpisode("user-1", messages, { chatId: "chat-1", messageCount: 10 });

    // Should embed the summary
    expect(mockEmbedTextCalls.length).toBeGreaterThanOrEqual(1);

    // Should insert into jadlis_documents
    const insertOp = supabaseOps.find((o) => o.table === "jadlis_documents" && o.operation === "insert");
    expect(insertOp).toBeDefined();
    expect(insertOp!.data.source_type).toBe("memory_episode");
    expect(insertOp!.data.user_id).toBe("user-1");
    expect(insertOp!.data.metadata.chatId).toBe("chat-1");
    expect(insertOp!.data.metadata.messageCount).toBe(10);
  });
});

describe("Episode trigger logic", () => {
  test("shouldTriggerEpisodeSummarization returns true when message_count % 10 === 0", async () => {
    const { shouldTriggerEpisodeSummarization } = await import("../memory");
    expect(shouldTriggerEpisodeSummarization(10)).toBe(true);
    expect(shouldTriggerEpisodeSummarization(20)).toBe(true);
    expect(shouldTriggerEpisodeSummarization(100)).toBe(true);
  });

  test("shouldTriggerEpisodeSummarization returns false when message_count % 10 !== 0", async () => {
    const { shouldTriggerEpisodeSummarization } = await import("../memory");
    expect(shouldTriggerEpisodeSummarization(0)).toBe(false);
    expect(shouldTriggerEpisodeSummarization(1)).toBe(false);
    expect(shouldTriggerEpisodeSummarization(11)).toBe(false);
    expect(shouldTriggerEpisodeSummarization(15)).toBe(false);
  });
});

// ============================================================
// Semantic retrieval (Level 1 + 3 combined)
// ============================================================

describe("searchMemory()", () => {
  test("queries with source_types=['memory_fact','memory_episode']", async () => {
    mockSemanticSearchResult = [
      { id: "1", content: "sleep preference", metadata: {}, similarity: 0.9 },
    ];

    const { searchMemory } = await import("../memory");
    await searchMemory("сон", "user-1");

    expect(mockSemanticSearchCalls.length).toBe(1);
    expect(mockSemanticSearchCalls[0].options.sourceTypes).toEqual(["memory_fact", "memory_episode"]);
    expect(mockSemanticSearchCalls[0].options.userId).toBe("user-1");
  });

  test("returns results in similarity-descending order", async () => {
    mockSemanticSearchResult = [
      { id: "1", content: "high", metadata: {}, similarity: 0.95 },
      { id: "2", content: "low", metadata: {}, similarity: 0.75 },
    ];

    const { searchMemory } = await import("../memory");
    const results = await searchMemory("test", "user-1");

    expect(results.length).toBe(2);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
  });
});
