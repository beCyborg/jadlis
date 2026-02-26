import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Constants
// ============================================================

const VOYAGE_MODEL = "voyage-3-large";
const EMBEDDING_DIMENSIONS = 1024;
const MAX_BATCH_SIZE = 100;
const MAX_TOKENS = 512;
const OVERLAP_TOKENS = 64;
const OVERLAP_CHARS = OVERLAP_TOKENS * 4; // ~256 chars
const EFFECTIVE_MAX_TOKENS = MAX_TOKENS - OVERLAP_TOKENS; // 448 — room for overlap
const SEPARATORS = ["\n\n", "\n", ". ", " "];

// ============================================================
// Types
// ============================================================

type InputType = "document" | "query";

export interface EmbedOptions {
  inputType: InputType;
}

export interface ChunkMetadata {
  headers: Record<string, string>;
  chunkIndex: number;
  sourceFile?: string;
}

export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

// ============================================================
// Clients (singletons, lazy-loaded to avoid import-time side effects)
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _voyageClient: any = null;
let _supabase: SupabaseClient | null = null;

function getVoyageClient() {
  if (!_voyageClient) {
    if (!process.env.VOYAGE_API_KEY) {
      throw new Error("VOYAGE_API_KEY environment variable is required");
    }
    // Lazy require to avoid top-level import that breaks Bun test runner
    const { VoyageAIClient } = require("voyageai");
    _voyageClient = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY,
    });
  }
  return _voyageClient;
}

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required",
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }
  return _supabase!;
}

/** Reset cached clients — used by tests */
export function _resetClients(): void {
  _voyageClient = null;
  _supabase = null;
}

/** @internal Test-only: inject mock Voyage client */
export function _setVoyageClientForTest(client: unknown): void {
  _voyageClient = client;
}

// ============================================================
// Token estimation
// ============================================================

function estimateTokens(text: string): number {
  // Кириллица: ~2 символа на токен, латиница: ~4 символа на токен
  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const cyrillicRatio = text.length > 0 ? cyrillicCount / text.length : 0;
  const charsPerToken = cyrillicRatio > 0.3 ? 2 : 4;
  return Math.ceil(text.length / charsPerToken);
}

// ============================================================
// Embedding functions
// ============================================================

export async function embedText(
  text: string,
  options: EmbedOptions,
): Promise<number[]> {
  const client = getVoyageClient();
  const response = await client.embed({
    input: text,
    model: VOYAGE_MODEL,
    inputType: options.inputType,
    outputDimension: EMBEDDING_DIMENSIONS,
  });

  const item = response.data?.[0];
  if (!item?.embedding) {
    throw new Error("Voyage API returned empty embedding");
  }
  return item.embedding;
}

export async function embedBatch(
  texts: string[],
  options: EmbedOptions,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getVoyageClient();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await client.embed({
      input: batch,
      model: VOYAGE_MODEL,
      inputType: options.inputType,
      outputDimension: EMBEDDING_DIMENSIONS,
    });

    const embeddings = (response.data ?? [])
      .sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
      .map((item: { embedding?: number[] }) => {
        if (!item.embedding) {
          throw new Error("Voyage API returned empty embedding in batch");
        }
        return item.embedding;
      });

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

// ============================================================
// Header context builder
// ============================================================

function buildHeaderPrefix(headers: Record<string, string>): string {
  const parts: string[] = [];
  if (headers.h1) parts.push(`# ${headers.h1}`);
  if (headers.h2) parts.push(`## ${headers.h2}`);
  if (headers.h3) parts.push(`### ${headers.h3}`);
  return parts.length > 0 ? parts.join("\n") + "\n\n" : "";
}

// ============================================================
// Stage 1: Markdown Header Split
// ============================================================

export function markdownHeaderSplit(
  content: string,
  sourceFile?: string,
): DocumentChunk[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const chunks: DocumentChunk[] = [];
  let currentHeaders: Record<string, string> = {};
  let currentContent: string[] = [];
  let chunkIndex = 0;

  function flush() {
    const bodyText = currentContent.join("\n").trim();
    if (bodyText) {
      // Prepend header hierarchy to content for better retrieval
      const prefix = buildHeaderPrefix(currentHeaders);
      chunks.push({
        content: prefix + bodyText,
        metadata: {
          headers: { ...currentHeaders },
          chunkIndex: chunkIndex++,
          sourceFile,
        },
      });
    }
    currentContent = [];
  }

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      flush();
      currentHeaders = { h1: h1Match[1].trim() };
    } else if (h2Match) {
      flush();
      currentHeaders = {
        ...(currentHeaders.h1 ? { h1: currentHeaders.h1 } : {}),
        h2: h2Match[1].trim(),
      };
    } else if (h3Match) {
      flush();
      currentHeaders = {
        ...(currentHeaders.h1 ? { h1: currentHeaders.h1 } : {}),
        ...(currentHeaders.h2 ? { h2: currentHeaders.h2 } : {}),
        h3: h3Match[1].trim(),
      };
    } else {
      currentContent.push(line);
    }
  }

  flush();
  return chunks;
}

// ============================================================
// Stage 2: Recursive Character Text Splitter
// ============================================================

function splitBySeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  return parts.map((part, i) =>
    i < parts.length - 1 ? part + separator : part,
  );
}

function recursiveSplitText(
  text: string,
  maxChars: number,
  separatorIndex: number = 0,
): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  if (separatorIndex >= SEPARATORS.length) {
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      parts.push(text.slice(i, i + maxChars));
    }
    return parts;
  }

  const separator = SEPARATORS[separatorIndex];
  const parts = splitBySeparator(text, separator);

  if (parts.length <= 1) {
    return recursiveSplitText(text, maxChars, separatorIndex + 1);
  }

  const result: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length > maxChars && current) {
      result.push(current);
      current = part;
    } else {
      current += part;
    }
  }

  if (current) {
    result.push(current);
  }

  const finalResult: string[] = [];
  for (const chunk of result) {
    if (chunk.length > maxChars) {
      finalResult.push(
        ...recursiveSplitText(chunk, maxChars, separatorIndex + 1),
      );
    } else {
      finalResult.push(chunk);
    }
  }

  return finalResult;
}

export function recursiveSplit(
  chunks: DocumentChunk[],
  maxTokens: number = MAX_TOKENS,
  overlap: number = OVERLAP_TOKENS,
): DocumentChunk[] {
  const result: DocumentChunk[] = [];
  // Account for overlap: split at (maxTokens - overlap) so after prepending overlap
  // the final chunk stays within maxTokens
  const effectiveMaxChars = (maxTokens - overlap) * 4;

  for (const chunk of chunks) {
    if (estimateTokens(chunk.content) <= maxTokens) {
      result.push(chunk);
      continue;
    }

    const subTexts = recursiveSplitText(chunk.content, effectiveMaxChars);
    const overlapChars = overlap * 4;

    for (let i = 0; i < subTexts.length; i++) {
      let text = subTexts[i];

      if (i > 0) {
        const prevText = subTexts[i - 1];
        const overlapText = prevText.slice(-overlapChars);
        text = overlapText + text;
      }

      result.push({
        content: text.trim(),
        metadata: {
          ...chunk.metadata,
          headers: { ...chunk.metadata.headers },
          chunkIndex: result.length,
        },
      });
    }
  }

  return result;
}

// ============================================================
// Full chunking pipeline
// ============================================================

export function chunkDocument(
  content: string,
  sourceFile?: string,
): DocumentChunk[] {
  const headerChunks = markdownHeaderSplit(content, sourceFile);
  if (headerChunks.length === 0) return [];
  return recursiveSplit(headerChunks);
}

// ============================================================
// Index chunks to Supabase
// ============================================================

export async function indexChunks(
  chunks: DocumentChunk[],
  userId: string,
  sourceType: string,
): Promise<void> {
  if (chunks.length === 0) return;

  const supabase = getSupabase();

  // Embed FIRST — if Voyage fails, existing data stays intact
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts, { inputType: "document" });

  // Delete existing records for idempotent re-indexing (after successful embed)
  const { error: deleteError } = await supabase
    .from("jadlis_documents")
    .delete()
    .eq("user_id", userId)
    .eq("source_type", sourceType);

  if (deleteError) {
    throw new Error(
      `Failed to delete existing chunks: ${deleteError.message}`,
    );
  }

  // Insert rows — pass embedding as number[] (Supabase handles pgvector conversion)
  const rows = chunks.map((chunk, i) => ({
    user_id: userId,
    source_type: sourceType,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: embeddings[i],
  }));

  const { error } = await supabase.from("jadlis_documents").insert(rows);
  if (error) {
    throw new Error(`Failed to insert chunks: ${error.message}`);
  }
}
