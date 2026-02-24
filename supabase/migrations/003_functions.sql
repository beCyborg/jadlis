-- 003_functions.sql
-- Jadlis: SQL-функции для бизнес-логики

-- ============================================================
-- search_documents: семантический поиск по embeddings
-- ============================================================
-- Вызывается из @jadlis/ai через Supabase RPC.
-- Оператор <=> — косинусное расстояние. Similarity = 1 - distance.
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(1024),
  p_user_id UUID,
  p_source_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::FLOAT AS similarity
  FROM jadlis_documents d
  WHERE
    d.user_id = p_user_id
    AND d.embedding IS NOT NULL
    AND (p_source_types IS NULL OR d.source_type = ANY(p_source_types))
    AND 1 - (d.embedding <=> query_embedding) > similarity_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- calculate_need_score: NeedScore по формуле из @jadlis/shared
-- ============================================================
-- Formula: (WeightedMean - 0.15 * CV_score) * FloorPenalty
--   WeightedMean = sum(value_i * weight_i) / sum(weight_i)
--   CV = StdDev / Mean (коэффициент вариации)
--   CV_score = CV * 100
--   FloorPenalty = 0.5 + 0.5 * (min_value / 20) if min_value < 20, else 1.0
CREATE OR REPLACE FUNCTION calculate_need_score(
  p_need_id UUID,
  p_user_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  weighted_mean NUMERIC;
  total_weight NUMERIC;
  variance NUMERIC;
  stddev NUMERIC;
  cv NUMERIC;
  cv_score NUMERIC;
  min_value NUMERIC;
  floor_penalty NUMERIC;
  raw_score NUMERIC;
BEGIN
  -- CTE: один scan — последнее normalized_value и weight для каждой метрики
  SELECT
    COALESCE(SUM(nv * w) / NULLIF(SUM(w), 0), 0),
    COALESCE(SUM(w), 0),
    COALESCE(MIN(nv), 0)
  INTO weighted_mean, total_weight, min_value
  FROM (
    SELECT m.weight AS w, (
      SELECT mv.normalized_value
      FROM metric_values mv
      WHERE mv.metric_id = m.id AND mv.user_id = p_user_id
      ORDER BY mv.recorded_at DESC
      LIMIT 1
    ) AS nv
    FROM metrics m
    WHERE m.need_id = p_need_id AND m.user_id = p_user_id
  ) latest_values
  WHERE nv IS NOT NULL;

  IF total_weight = 0 THEN
    RETURN 0;
  END IF;

  -- Взвешенная дисперсия (один дополнительный scan)
  SELECT
    COALESCE(SUM(w * POWER(nv - weighted_mean, 2)) / NULLIF(total_weight, 0), 0)
  INTO variance
  FROM (
    SELECT m.weight AS w, (
      SELECT mv.normalized_value
      FROM metric_values mv
      WHERE mv.metric_id = m.id AND mv.user_id = p_user_id
      ORDER BY mv.recorded_at DESC
      LIMIT 1
    ) AS nv
    FROM metrics m
    WHERE m.need_id = p_need_id AND m.user_id = p_user_id
  ) latest_values
  WHERE nv IS NOT NULL;

  stddev := SQRT(variance);
  cv := CASE WHEN weighted_mean > 0 THEN stddev / weighted_mean ELSE 0 END;
  cv_score := cv * 100;

  -- FloorPenalty: штраф при критически низких метриках (< 20)
  floor_penalty := CASE
    WHEN min_value >= 20 THEN 1.0
    ELSE 0.5 + 0.5 * (min_value / 20.0)
  END;

  -- Итоговый скор
  raw_score := (weighted_mean - 0.15 * cv_score) * floor_penalty;

  -- Clamp 0-100
  RETURN GREATEST(0, LEAST(100, raw_score));
END;
$$;

-- ============================================================
-- update_habit_momentum: EWMA momentum (шкала 0-100)
-- ============================================================
-- Formula: M_new = α × (X × 100) + (1 - α) × M_old
-- α = 0.3, X = 1 (completed) | 0 (missed)
-- Соответствует TypeScript: calculateEWMA из @jadlis/shared
CREATE OR REPLACE FUNCTION update_habit_momentum(
  p_habit_id UUID,
  p_completed BOOLEAN
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  new_momentum NUMERIC;
BEGIN
  -- Atomic UPDATE RETURNING — no race condition
  UPDATE habits
  SET momentum = GREATEST(0, LEAST(100,
    0.3 * (CASE WHEN p_completed THEN 100.0 ELSE 0.0 END) + 0.7 * momentum
  ))
  WHERE id = p_habit_id
  RETURNING momentum INTO new_momentum;

  RETURN new_momentum;
END;
$$;
