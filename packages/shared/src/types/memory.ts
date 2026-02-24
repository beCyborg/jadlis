export type MemoryFactCategory =
  | "preference"
  | "decision"
  | "personality"
  | "context";
export type MemoryFactSource = "user_stated" | "inferred" | "observed";
export type SwotType = "strength" | "weakness" | "opportunity" | "threat";
export type SwotSource = "manual" | "news_digest" | "research";

export interface MemoryFact {
  id: string;
  user_id: string;
  category: MemoryFactCategory;
  key: string;
  value: string;
  confidence: number;
  source: MemoryFactSource;
  last_accessed: Date;
  created_at: Date;
}

export interface SwotEntry {
  id: string;
  user_id: string;
  type: SwotType;
  description: string;
  source: SwotSource;
  impact: number;
  probability: number;
  affected_goals: string[];
  created_at: Date;
}

export interface EnergyLeak {
  id: string;
  user_id: string;
  description: string;
  category: string;
  severity: number;
  status: "active" | "resolved";
  resolution: string | null;
  created_at: Date;
}

export interface BotSession {
  key: string;
  value: BotSessionData;
  updated_at: Date;
}

export interface BotSessionData {
  step: string | null;
  current_ritual: string | null;
  conversation_context: string | null;
  processing: boolean;
  working_memory_cache: string | null;
  working_memory_updated_at: number | null;
  message_count: number;
}
