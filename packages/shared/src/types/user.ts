export interface User {
  id: string;
  telegram_id: number;
  username: string;
  created_at: Date;
  settings: Record<string, unknown>;
}
