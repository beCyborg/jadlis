export interface User {
  id: string;
  /** Supabase returns BIGINT as string; Telegram IDs > 2^53 possible */
  telegram_id: string;
  username: string;
  created_at: Date;
  settings: Record<string, unknown>;
}
