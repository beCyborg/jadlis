import { createClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";

// ============================================================
// Types
// ============================================================

export interface SearchOptions {
  sourceTypes?: string[];
  limit?: number;
  similarityThreshold?: number;
  userId: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ============================================================
// Client
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }
  return _supabase;
}

// ============================================================
// Semantic Search
// ============================================================

export async function semanticSearch(
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const embedding = await embedText(query, { inputType: "query" });

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("search_documents", {
    query_embedding: embedding,
    p_user_id: options.userId,
    p_source_types: options.sourceTypes ?? null,
    p_limit: options.limit ?? 5,
    similarity_threshold: options.similarityThreshold ?? 0.7,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return (data ?? []) as SearchResult[];
}
