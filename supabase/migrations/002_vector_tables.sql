-- 002_vector_tables.sql
-- Jadlis: pgvector embeddings + memory facts

-- Включить pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- jadlis_documents (единая таблица для всех embeddings)
-- ============================================================
-- source_type: 'framework', 'goal', 'reflection', 'news', 'research',
--              'habit', 'life_value', 'memory_fact', 'memory_episode'
CREATE TABLE jadlis_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW индекс для косинусного расстояния
-- m=16, ef_construction=64 (Supabase Free/Pro начальные параметры)
CREATE INDEX idx_jadlis_documents_embedding ON jadlis_documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_jadlis_documents_user_source ON jadlis_documents(user_id, source_type);
CREATE INDEX idx_jadlis_documents_user_time ON jadlis_documents(user_id, created_at DESC);

-- ============================================================
-- memory_facts (долгосрочная структурированная память)
-- ============================================================
-- Авторитетное хранилище для быстрого lookup по ключу.
-- Параллельно каждый факт индексируется в jadlis_documents
-- с source_type = 'memory_fact' для семантического поиска.
CREATE TABLE memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'user_stated',
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);
