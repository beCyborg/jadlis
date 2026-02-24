import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { embedText } from "./embeddings";
import { semanticSearch, type SearchResult } from "./search";
import type {
  MemoryFactCategory,
  MemoryFactSource,
  MemoryFact,
} from "@jadlis/shared";

// ============================================================
// Clients (singletons)
// ============================================================

let _supabase: SupabaseClient | null = null;
let _anthropic: Anthropic | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required",
      );
    }
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }
  return _supabase;
}

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/** Reset cached clients — used by tests */
export function _resetClients(): void {
  _supabase = null;
  _anthropic = null;
}

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
const CACHE_TTL_MS = 3600 * 1000; // 1 hour
const MAX_HABITS_IN_WORKING_MEMORY = 10;

// ============================================================
// Level 1 — Long-term Memory (memory_facts + jadlis_documents)
// ============================================================

export async function readFacts(
  userId: string,
  category?: MemoryFactCategory,
): Promise<MemoryFact[]> {
  const supabase = getSupabase();

  let query = supabase.from("memory_facts").select("*").eq("user_id", userId);
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to read facts: ${error.message}`);
  }

  const facts = (data ?? []) as MemoryFact[];

  // Update last_accessed for returned facts (fire-and-forget)
  if (facts.length > 0) {
    const ids = facts.map((f) => f.id);
    supabase
      .from("memory_facts")
      .update({ last_accessed: new Date().toISOString() })
      .in("id", ids)
      .then(() => {}, (err: any) => {
        console.error("[jadlis:memory] Failed to update last_accessed:", err);
      });
  }

  return facts;
}

export async function writeFact(
  userId: string,
  key: string,
  value: string,
  options?: {
    category?: MemoryFactCategory;
    confidence?: number;
    source?: MemoryFactSource;
  },
): Promise<void> {
  const supabase = getSupabase();
  const category = options?.category ?? "context";
  const confidence = options?.confidence ?? 1.0;
  const source = options?.source ?? "inferred";

  // 1. Upsert SQL store (authoritative)
  const { error: factError } = await supabase.from("memory_facts").upsert(
    {
      user_id: userId,
      key,
      value,
      category,
      confidence,
      source,
      last_accessed: new Date().toISOString(),
    },
    { onConflict: "user_id,key" },
  );

  if (factError) {
    throw new Error(`Failed to write fact: ${factError.message}`);
  }

  // 2. Embed and write to vector store (best-effort)
  // Strategy: delete existing vector for this fact key, then insert new one.
  // This avoids relying on composite unique constraints that may not exist.
  try {
    const embeddingText = `${key}: ${value}`;
    const embedding = await embedText(embeddingText, { inputType: "document" });

    // Delete any existing vector for this fact key
    await supabase
      .from("jadlis_documents")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "memory_fact")
      .filter("metadata->>factKey", "eq", key);

    // Insert new vector
    await supabase.from("jadlis_documents").insert({
      user_id: userId,
      source_type: "memory_fact",
      content: embeddingText,
      embedding,
      metadata: { factKey: key, category },
    });
  } catch (err) {
    console.error("[jadlis:memory] Embedding step failed for writeFact:", err);
    // Do not throw — SQL store is the authority
  }
}

export async function deleteFact(
  userId: string,
  key: string,
): Promise<void> {
  const supabase = getSupabase();

  // Delete from SQL store
  const { error: factError } = await supabase
    .from("memory_facts")
    .delete()
    .eq("user_id", userId)
    .eq("key", key);

  if (factError) {
    console.error("[jadlis:memory] Failed to delete fact from memory_facts:", factError);
  }

  // Delete from vector store — filter by metadata factKey for precision
  const { error: docError } = await supabase
    .from("jadlis_documents")
    .delete()
    .eq("user_id", userId)
    .eq("source_type", "memory_fact")
    .filter("metadata->>factKey", "eq", key);

  if (docError) {
    console.error("[jadlis:memory] Failed to delete fact from jadlis_documents:", docError);
  }
}

// ============================================================
// Level 2 — Working Memory (system prompt injection)
// ============================================================

export async function buildWorkingMemory(
  userId: string,
  chatId: string,
): Promise<string> {
  const supabase = getSupabase();

  // 1. Check cache
  const { data: sessionData } = await supabase
    .from("bot_sessions")
    .select("value")
    .eq("key", chatId)
    .single();

  const session = sessionData?.value;

  if (
    session?.working_memory_cache &&
    session?.working_memory_updated_at &&
    Date.now() - session.working_memory_updated_at < CACHE_TTL_MS
  ) {
    return session.working_memory_cache;
  }

  // 2. Cache miss — rebuild
  const [goalsResult, habitsResult, factsResult] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("progress", { ascending: false })
      .limit(3),
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("momentum", { ascending: false })
      .limit(MAX_HABITS_IN_WORKING_MEMORY),
    supabase
      .from("memory_facts")
      .select("*")
      .eq("user_id", userId)
      .eq("category", "context")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const goals = (goalsResult.data ?? []).slice(0, 3);
  const habits = (habitsResult.data ?? []).slice(0, MAX_HABITS_IN_WORKING_MEMORY);
  const facts = (factsResult.data ?? []).slice(0, 3);

  // 3. Format
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [];
  lines.push(`=== Рабочая память (обновлено ${dateStr}) ===`);
  lines.push("");

  if (goals.length > 0) {
    lines.push("Активные цели (топ 3):");
    goals.forEach((g: any, i: number) => {
      const progress = `[прогресс: ${g.progress ?? 0}%]`;
      const deadline = g.target_date ? ` — срок: ${g.target_date}` : "";
      lines.push(`${i + 1}. ${g.title} ${progress}${deadline}`);
    });
    lines.push("");
  }

  if (habits.length > 0) {
    lines.push("Активные привычки:");
    habits.forEach((h: any) => {
      const momentum = h.momentum != null ? `momentum: ${h.momentum}` : "";
      const streak = h.streak != null ? `серия: ${h.streak} дней` : "";
      const parts = [momentum, streak].filter(Boolean).join(", ");
      lines.push(`- ${h.name}${parts ? ` [${parts}]` : ""}`);
    });
    lines.push("");
  }

  if (facts.length > 0) {
    lines.push("Последние инсайты:");
    facts.forEach((f: any) => {
      lines.push(`- ${f.key}: ${f.value}`);
    });
    lines.push("");
  }

  const workingMemory = lines.join("\n");

  // 4. Persist cache — re-read session to avoid lost update on concurrent upsert
  const { data: freshSession } = await supabase
    .from("bot_sessions")
    .select("value")
    .eq("key", chatId)
    .single();

  await supabase.from("bot_sessions").upsert({
    key: chatId,
    value: {
      ...(freshSession?.value ?? session),
      working_memory_cache: workingMemory,
      working_memory_updated_at: Date.now(),
    },
    updated_at: new Date().toISOString(),
  });

  return workingMemory;
}

export async function invalidateWorkingMemoryCache(
  chatId: string,
): Promise<void> {
  const supabase = getSupabase();

  const { data: sessionData } = await supabase
    .from("bot_sessions")
    .select("value")
    .eq("key", chatId)
    .single();

  const session = sessionData?.value ?? {};

  await supabase.from("bot_sessions").upsert({
    key: chatId,
    value: {
      ...session,
      working_memory_updated_at: null,
    },
    updated_at: new Date().toISOString(),
  });
}

// ============================================================
// Level 3 — Episodic Memory (pgvector)
// ============================================================

export function shouldTriggerEpisodeSummarization(
  messageCount: number,
): boolean {
  return messageCount > 0 && messageCount % 10 === 0;
}

export async function summarizeAndStoreEpisode(
  userId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  metadata?: { chatId: string; messageCount: number },
): Promise<void> {
  const anthropic = getAnthropic();
  const supabase = getSupabase();

  // 1. Summarize via Claude
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Резюмируй этот диалог в 3-5 предложениях. Фокус:
- Что обсуждалось
- Ключевые решения
- Эмоциональное состояние пользователя (если видно)
- Факты о пользователе (предпочтения, цели, привычки)

Компактно и фактологично. На русском.

Диалог:
${conversationText}`,
        },
      ],
    });

    const summaryBlock = response.content.find((b) => b.type === "text");
    const summary = summaryBlock?.type === "text" ? summaryBlock.text : "";
    if (!summary) return;

    // 2. Embed and store
    const embedding = await embedText(summary, { inputType: "document" });

    await supabase.from("jadlis_documents").insert({
      user_id: userId,
      source_type: "memory_episode",
      content: summary,
      embedding,
      metadata: {
        messageCount: metadata?.messageCount ?? messages.length,
        timestamp: new Date().toISOString(),
        chatId: metadata?.chatId ?? "unknown",
      },
    });
  } catch (err) {
    console.error("[jadlis:memory] summarizeAndStoreEpisode failed:", err);
  }

  // Note: Step 5 (fact extraction from episodes) deferred to post-MVP
}

// ============================================================
// Semantic Memory Retrieval (Level 1 + 3 combined)
// ============================================================

export async function searchMemory(
  query: string,
  userId: string,
  options?: {
    limit?: number;
    similarityThreshold?: number;
  },
): Promise<SearchResult[]> {
  return semanticSearch(query, {
    userId,
    sourceTypes: ["memory_fact", "memory_episode"],
    limit: options?.limit ?? 5,
    similarityThreshold: options?.similarityThreshold ?? 0.7,
  });
}
