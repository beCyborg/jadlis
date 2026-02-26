import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserRow {
  id: string;
  telegram_id: string;
  username: string | null;
  settings: Record<string, unknown>;
}

export class UserRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, telegram_id, username, settings")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[UserRepository] findById error:", error);
      return null;
    }
    return data;
  }

  async findByTelegramId(telegramId: number): Promise<UserRow | null> {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, telegram_id, username, settings")
      .eq("telegram_id", telegramId)
      .single();

    if (error) {
      console.error("[UserRepository] findByTelegramId error:", error);
      return null;
    }
    return data;
  }

  async updateSettings(
    userId: string,
    settings: Record<string, unknown>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("users")
      .update({ settings })
      .eq("id", userId);

    if (error) {
      console.error("[UserRepository] updateSettings error:", error);
      return false;
    }
    return true;
  }

  async mergeSettings(
    userId: string,
    partial: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const merged = { ...user.settings, ...partial };
    const ok = await this.updateSettings(userId, merged);
    return ok ? merged : null;
  }
}
