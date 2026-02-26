import { describe, test, expect, beforeEach } from "bun:test";
import {
  embedText,
  embedBatch,
  markdownHeaderSplit,
  recursiveSplit,
  chunkDocument,
  _resetClients,
  _setVoyageClientForTest,
} from "../embeddings";

// ============================================================
// Mock Voyage client
// ============================================================

const MOCK_EMBEDDING = new Array(1024).fill(0).map((_, i) => i * 0.001);
let mockEmbedCalls: any[] = [];
let mockEmbedDynamic = false;

function createMockVoyageClient() {
  return {
    embed: async (params: any) => {
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
    },
  };
}

// ============================================================
// Tests
// ============================================================

describe("embedText()", () => {
  beforeEach(() => {
    mockEmbedCalls = [];
    mockEmbedDynamic = false;
    _resetClients();
    _setVoyageClientForTest(createMockVoyageClient());
  });

  test("calls Voyage API with model=voyage-3-large and outputDimension=1024", async () => {
    await embedText("test text", { inputType: "document" });

    expect(mockEmbedCalls.length).toBe(1);
    expect(mockEmbedCalls[0].model).toBe("voyage-3-large");
    expect(mockEmbedCalls[0].outputDimension).toBe(1024);
  });

  test("uses inputType=document for indexing mode", async () => {
    await embedText("test text", { inputType: "document" });

    expect(mockEmbedCalls[0].inputType).toBe("document");
  });

  test("uses inputType=query for search mode", async () => {
    await embedText("test query", { inputType: "query" });

    expect(mockEmbedCalls[0].inputType).toBe("query");
  });

  test("returns 1024-dimensional embedding", async () => {
    const result = await embedText("test text", { inputType: "document" });

    expect(result.length).toBe(1024);
  });
});

describe("embedBatch()", () => {
  beforeEach(() => {
    mockEmbedCalls = [];
    mockEmbedDynamic = true;
    _resetClients();
    _setVoyageClientForTest(createMockVoyageClient());
  });

  test("does not exceed batch size of 100 in single API call", async () => {
    const texts = Array.from({ length: 50 }, (_, i) => `text ${i}`);
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
    const results = await embedBatch(texts, { inputType: "document" });

    expect(mockEmbedCalls.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBe(150);
  });
});

describe("markdownHeaderSplit()", () => {
  test("preserves h1, h2, h3 hierarchy in chunk metadata", () => {
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

  test("clears lower headers when higher header encountered", () => {
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

  test("includes header text in chunk content for retrieval", () => {
    const md = `# Introduction
Some intro text.

## Details
Detail text here.`;

    const chunks = markdownHeaderSplit(md);

    expect(chunks[0].content).toContain("# Introduction");
    expect(chunks[0].content).toContain("Some intro text.");

    expect(chunks[1].content).toContain("# Introduction");
    expect(chunks[1].content).toContain("## Details");
    expect(chunks[1].content).toContain("Detail text here.");
  });
});

describe("recursiveSplit()", () => {
  test("produces chunks of at most 512 tokens (~2048 chars)", () => {
    const longContent = "Word ".repeat(600);

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

  test("applies overlap between consecutive chunks", () => {
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
      const chunk0 = result[0].content;
      const chunk1 = result[1].content;

      const overlapMarker = chunk0.slice(-100);
      expect(chunk1.includes(overlapMarker)).toBe(true);
    }
  });

  test("preserves parent metadata on sub-chunks", () => {
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
  test("returns empty array for empty document", () => {
    const result = chunkDocument("");
    expect(result).toEqual([]);
  });

  test("handles document with no markdown headers", () => {
    const content = "Just plain text without any headers.\nAnother line.";
    const result = chunkDocument(content);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].content).toContain("Just plain text");
  });

  test("full pipeline: header split then recursive split", () => {
    const md = `# Introduction
Short intro.

## Details
${"Detail text. ".repeat(200)}`;

    const result = chunkDocument(md);

    expect(result.length).toBeGreaterThan(1);
    expect(result[0].metadata.headers.h1).toBe("Introduction");
  });
});
