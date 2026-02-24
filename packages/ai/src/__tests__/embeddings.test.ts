import { describe, test, expect, mock, beforeEach } from "bun:test";

// ============================================================
// Mock Voyage AI SDK
// ============================================================

const MOCK_EMBEDDING = new Array(1024).fill(0).map((_, i) => i * 0.001);
let mockEmbedCalls: any[] = [];
let mockEmbedDynamic = false;

mock.module("voyageai", () => ({
  VoyageAIClient: class {
    embed = async (params: any) => {
      mockEmbedCalls.push(params);
      if (mockEmbedDynamic) {
        const batchSize = Array.isArray(params.input)
          ? params.input.length
          : 1;
        return {
          data: Array.from({ length: batchSize }, (_, i) => ({
            embedding: MOCK_EMBEDDING,
            index: i,
          })),
          usage: { totalTokens: batchSize },
        };
      }
      return {
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
        usage: { totalTokens: 10 },
      };
    };
  },
}));

// ============================================================
// Mock Supabase client
// ============================================================

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async (rows: any) => ({ data: null, error: null }),
      delete: () => ({
        eq: (col: string, val: string) => ({
          eq: (col2: string, val2: string) =>
            Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

// ============================================================
// Tests
// ============================================================

describe("embedText()", () => {
  beforeEach(() => {
    mockEmbedCalls = [];
    mockEmbedDynamic = false;
    process.env.VOYAGE_API_KEY = "test-key";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  });

  test("calls Voyage API with model=voyage-3-large and outputDimension=1024", async () => {
    const { embedText, _resetClients } = await import("../embeddings");
    _resetClients();
    await embedText("test text", { inputType: "document" });

    expect(mockEmbedCalls.length).toBe(1);
    expect(mockEmbedCalls[0].model).toBe("voyage-3-large");
    expect(mockEmbedCalls[0].outputDimension).toBe(1024);
  });

  test("uses inputType=document for indexing mode", async () => {
    const { embedText, _resetClients } = await import("../embeddings");
    _resetClients();
    await embedText("test text", { inputType: "document" });

    expect(mockEmbedCalls[0].inputType).toBe("document");
  });

  test("uses inputType=query for search mode", async () => {
    const { embedText, _resetClients } = await import("../embeddings");
    _resetClients();
    await embedText("test query", { inputType: "query" });

    expect(mockEmbedCalls[0].inputType).toBe("query");
  });

  test("returns 1024-dimensional embedding", async () => {
    const { embedText, _resetClients } = await import("../embeddings");
    _resetClients();
    const result = await embedText("test text", { inputType: "document" });

    expect(result.length).toBe(1024);
  });
});

describe("embedBatch()", () => {
  beforeEach(() => {
    mockEmbedCalls = [];
    mockEmbedDynamic = true;
    process.env.VOYAGE_API_KEY = "test-key";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  });

  test("does not exceed batch size of 100 in single API call", async () => {
    const texts = Array.from({ length: 50 }, (_, i) => `text ${i}`);

    const { embedBatch, _resetClients } = await import("../embeddings");
    _resetClients();
    await embedBatch(texts, { inputType: "document" });

    expect(mockEmbedCalls.length).toBe(1);
    expect(
      Array.isArray(mockEmbedCalls[0].input)
        ? mockEmbedCalls[0].input.length
        : 1,
    ).toBeLessThanOrEqual(100);
  });

  test("splits >100 texts into multiple batches and merges results", async () => {
    const texts = Array.from({ length: 150 }, (_, i) => `text ${i}`);

    const { embedBatch, _resetClients } = await import("../embeddings");
    _resetClients();
    const results = await embedBatch(texts, { inputType: "document" });

    expect(mockEmbedCalls.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBe(150);
  });
});

describe("markdownHeaderSplit()", () => {
  test("preserves h1, h2, h3 hierarchy in chunk metadata", async () => {
    const { markdownHeaderSplit } = await import("../embeddings");

    const md = `# Top Level
Some content here.

## Sub Section
More content.

### Sub Sub Section
Even more content.`;

    const chunks = markdownHeaderSplit(md, "test.md");

    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.metadata.headers.h1).toBe("Top Level");
    expect(lastChunk.metadata.headers.h2).toBe("Sub Section");
    expect(lastChunk.metadata.headers.h3).toBe("Sub Sub Section");
  });

  test("clears lower headers when higher header encountered", async () => {
    const { markdownHeaderSplit } = await import("../embeddings");

    const md = `# Section A
## A.1
### A.1.1
Content A.1.1

# Section B
Content B`;

    const chunks = markdownHeaderSplit(md);
    const sectionBChunk = chunks.find(
      (c) => c.metadata.headers.h1 === "Section B",
    );

    expect(sectionBChunk).toBeDefined();
    expect(sectionBChunk!.metadata.headers.h2).toBeUndefined();
    expect(sectionBChunk!.metadata.headers.h3).toBeUndefined();
  });

  test("includes header text in chunk content for retrieval", async () => {
    const { markdownHeaderSplit } = await import("../embeddings");

    const md = `# Introduction
Some intro text.

## Details
Detail text here.`;

    const chunks = markdownHeaderSplit(md);

    // First chunk should contain the h1 heading text
    expect(chunks[0].content).toContain("# Introduction");
    expect(chunks[0].content).toContain("Some intro text.");

    // Second chunk should contain h1 + h2 hierarchy
    expect(chunks[1].content).toContain("# Introduction");
    expect(chunks[1].content).toContain("## Details");
    expect(chunks[1].content).toContain("Detail text here.");
  });
});

describe("recursiveSplit()", () => {
  test("produces chunks of at most 512 tokens (~2048 chars)", async () => {
    const { recursiveSplit } = await import("../embeddings");

    const longContent = "Word ".repeat(600); // 3000 chars

    const input = [
      {
        content: longContent,
        metadata: { headers: { h1: "Test" }, chunkIndex: 0 },
      },
    ];

    const result = recursiveSplit(input);

    for (const chunk of result) {
      const estimatedTokens = Math.ceil(chunk.content.length / 4);
      expect(estimatedTokens).toBeLessThanOrEqual(512);
    }
    expect(result.length).toBeGreaterThan(1);
  });

  test("applies overlap between consecutive chunks", async () => {
    const { recursiveSplit } = await import("../embeddings");

    // Create paragraphs that force splitting
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) => `Paragraph ${i}: ${"content ".repeat(50)}`,
    );
    const longContent = paragraphs.join("\n\n");

    const input = [
      {
        content: longContent,
        metadata: { headers: { h1: "Test" }, chunkIndex: 0 },
      },
    ];

    const result = recursiveSplit(input);

    if (result.length >= 2) {
      // The end of chunk 0 should appear at the start of chunk 1 (overlap)
      const chunk0 = result[0].content;
      const chunk1 = result[1].content;

      // Get last 100 chars of chunk 0 as overlap marker
      const overlapMarker = chunk0.slice(-100);
      // Chunk 1 should start with content from the end of chunk 0
      expect(chunk1.includes(overlapMarker)).toBe(true);
    }
  });

  test("preserves parent metadata on sub-chunks", async () => {
    const { recursiveSplit } = await import("../embeddings");

    const longContent = "Word ".repeat(600);
    const input = [
      {
        content: longContent,
        metadata: {
          headers: { h1: "Parent", h2: "Sub" },
          chunkIndex: 0,
          sourceFile: "test.md",
        },
      },
    ];

    const result = recursiveSplit(input);

    for (const chunk of result) {
      expect(chunk.metadata.headers.h1).toBe("Parent");
      expect(chunk.metadata.headers.h2).toBe("Sub");
      expect(chunk.metadata.sourceFile).toBe("test.md");
    }
  });
});

describe("chunkDocument()", () => {
  test("returns empty array for empty document", async () => {
    const { chunkDocument } = await import("../embeddings");
    const result = chunkDocument("");
    expect(result).toEqual([]);
  });

  test("handles document with no markdown headers", async () => {
    const { chunkDocument } = await import("../embeddings");

    const content = "Just plain text without any headers.\nAnother line.";
    const result = chunkDocument(content);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].content).toContain("Just plain text");
  });

  test("full pipeline: header split then recursive split", async () => {
    const { chunkDocument } = await import("../embeddings");

    const md = `# Introduction
Short intro.

## Details
${"Detail text. ".repeat(200)}`;

    const result = chunkDocument(md);

    expect(result.length).toBeGreaterThan(1);
    expect(result[0].metadata.headers.h1).toBe("Introduction");
  });
});
