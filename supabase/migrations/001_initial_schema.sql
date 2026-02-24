-- 001_initial_schema.sql
-- Jadlis: все доменные таблицы, индексы, bot_sessions
-- RLS отключён — personal tool, единственный пользователь

-- ============================================================
-- users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- needs (15 потребностей)
-- ============================================================
CREATE TABLE needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  current_score NUMERIC(5,2) DEFAULT 0,
  target_score NUMERIC(5,2) DEFAULT 80,
  is_bridge_node BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, name)
);

-- ============================================================
-- metrics (~93 метрики, связанные с потребностями)
-- ============================================================
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  scale_type TEXT NOT NULL,
  scale_min NUMERIC NOT NULL DEFAULT 0,
  scale_max NUMERIC NOT NULL DEFAULT 100,
  scale_target NUMERIC,
  scale_threshold NUMERIC,
  weight NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  UNIQUE(user_id, code)
);

-- ============================================================
-- metric_values (временные ряды значений)
-- ============================================================
CREATE TABLE metric_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  normalized_value NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX idx_metric_values_metric_time ON metric_values(metric_id, recorded_at DESC);
CREATE INDEX idx_metric_values_user_time ON metric_values(user_id, recorded_at DESC);

-- Индексы на FK для calculate_need_score и частых запросов
CREATE INDEX idx_needs_user ON needs(user_id);
CREATE INDEX idx_metrics_need ON metrics(need_id);
CREATE INDEX idx_metrics_user ON metrics(user_id);
CREATE INDEX idx_goals_user ON goals(user_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_stage ON tasks(stage_id);
CREATE INDEX idx_swot_user ON swot(user_id);
CREATE INDEX idx_habits_user ON habits(user_id);

-- ============================================================
-- days (дневные записи)
-- ============================================================
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  overall_score NUMERIC(5,2),
  zone TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- weeks
-- ============================================================
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  overall_score NUMERIC(5,2),
  highlights JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, start_date)
);

-- ============================================================
-- months
-- ============================================================
CREATE TABLE months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  overall_score NUMERIC(5,2),
  highlights JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, start_date)
);

-- ============================================================
-- quarters
-- ============================================================
CREATE TABLE quarters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  overall_score NUMERIC(5,2),
  highlights JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, start_date)
);

-- ============================================================
-- goals (типы: Ф/Д/К)
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  target_date DATE,
  progress NUMERIC(5,2) DEFAULT 0,
  need_ids JSONB DEFAULT '[]'::jsonb
);

-- ============================================================
-- stages (этапы целей)
-- ============================================================
CREATE TABLE stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  target_date DATE
);

-- ============================================================
-- tasks (синхронизация с TickTick)
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  external_id TEXT
);

-- ============================================================
-- habits (COM-B структура)
-- ============================================================
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cue TEXT,
  routine TEXT,
  reward TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  momentum NUMERIC(5,2) DEFAULT 0,
  streak INTEGER DEFAULT 0,
  grace_days INTEGER DEFAULT 1,
  need_ids JSONB DEFAULT '[]'::jsonb
);

-- ============================================================
-- habit_completions
-- ============================================================
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_habit_completions_habit_time ON habit_completions(habit_id, completed_at DESC);
CREATE INDEX idx_habit_completions_user_time ON habit_completions(user_id, completed_at DESC);

-- ============================================================
-- bot_sessions (grammY PostgreSQL adapter)
-- ============================================================
CREATE TABLE bot_sessions (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- swot
-- ============================================================
CREATE TABLE swot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  impact NUMERIC(3,1),
  probability NUMERIC(4,3),
  affected_goals JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- energy_leaks
-- ============================================================
CREATE TABLE energy_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  severity INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
