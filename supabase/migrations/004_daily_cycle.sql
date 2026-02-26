-- Migration: 004_daily_cycle
-- Adds CHECK constraints for NeuroBalanceZone, TaskStatus, and Habit status

-- 1. CHECK constraint on days.zone for 7-zone NeuroBalanceZone values
ALTER TABLE days
  ADD CONSTRAINT chk_days_zone
  CHECK (zone IS NULL OR zone IN (
    'crisis', 'exhaustion', 'decline', 'stable', 'rise', 'flow', 'superflow'
  ));

-- 2. CHECK constraint on tasks.status for TaskStatus values
ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_status
  CHECK (status IN ('pending', 'in_progress', 'done', 'deferred', 'cancelled'));

-- 3. Add status column to habits (default "active" for all existing records)
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'paused', 'archived'));

-- 4. RPC: append highlight to day's JSONB array (avoids read-modify-write race)
CREATE OR REPLACE FUNCTION append_day_highlight(
  p_user_id UUID,
  p_date DATE,
  p_highlight TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE days
  SET highlights = COALESCE(highlights, '[]'::jsonb) || to_jsonb(p_highlight)
  WHERE user_id = p_user_id AND date = p_date;

  IF NOT FOUND THEN
    INSERT INTO days (user_id, date, highlights)
    VALUES (p_user_id, p_date, jsonb_build_array(p_highlight));
  END IF;
END;
$$ LANGUAGE plpgsql;
