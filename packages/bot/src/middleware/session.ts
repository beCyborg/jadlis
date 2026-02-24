import { session } from "grammy";
import type { StorageAdapter } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionData, BotContext } from "../bot";

export class SupabaseSessionAdapter implements StorageAdapter<SessionData> {
  constructor(private supabase: SupabaseClient) {}

  async read(key: string): Promise<SessionData | undefined> {
    const { data } = await this.supabase
      .from("bot_sessions")
      .select("value")
      .eq("key", key)
      .single();
    return data?.value ?? undefined;
  }

  async write(key: string, value: SessionData): Promise<void> {
    // Dirty flag: read existing, compare, skip if equal
    const { data: existing } = await this.supabase
      .from("bot_sessions")
      .select("value")
      .eq("key", key)
      .single();

    if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) {
      return; // No changes — skip write
    }

    await this.supabase.from("bot_sessions").upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  }

  async delete(key: string): Promise<void> {
    await this.supabase.from("bot_sessions").delete().eq("key", key);
  }
}

export async function setProcessingAtomic(
  supabase: SupabaseClient,
  key: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("set_session_processing", {
    p_key: key,
  });
  return data === true;
}

export function createSessionMiddleware(supabase: SupabaseClient) {
  return session<SessionData, BotContext>({
    initial: (): SessionData => ({
      step: "idle",
      current_ritual: null,
      conversation_context: "",
      processing: false,
      working_memory_cache: "",
      working_memory_updated_at: null,
      message_count: 0,
    }),
    getSessionKey: (ctx) => String(ctx.chat?.id),
    storage: new SupabaseSessionAdapter(supabase),
  });
}
