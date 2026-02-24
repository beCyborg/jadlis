-- seed.sql
-- Начальные данные Jadlis: 1 пользователь, 15 потребностей, 93 метрики
-- ВАЖНО: Замените YOUR_TELEGRAM_ID на ваш реальный Telegram user ID

DO $$
DECLARE
  v_telegram_id CONSTANT BIGINT := 000000000;  -- <- YOUR_TELEGRAM_ID
  v_user_id UUID;
  v_need_id UUID;
BEGIN

-- Защита от запуска без подстановки реального Telegram ID
IF v_telegram_id = 0 THEN
  RAISE EXCEPTION 'Замените v_telegram_id на ваш реальный Telegram user ID (строка 7)';
END IF;

-- ============================================================
-- Пользователь
-- ============================================================
INSERT INTO users (telegram_id, username)
VALUES (v_telegram_id, 'jadlis_user')
ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
RETURNING id INTO v_user_id;

-- ============================================================
-- 15 потребностей (идемпотентно: ON CONFLICT DO NOTHING)
-- ============================================================

-- Layer 1: Физиология (foundation / biological)
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'sleep', 'foundation', 'biological', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'nutrition', 'foundation', 'biological', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'movement', 'foundation', 'biological', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'health', 'foundation', 'biological', true) ON CONFLICT (user_id, name) DO NOTHING;

-- Layer 2: Безопасность (foundation / psychological)
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'safety', 'foundation', 'psychological', true) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'orientation', 'foundation', 'psychological', true) ON CONFLICT (user_id, name) DO NOTHING;

-- Layer 3: Принадлежность (parallel / psychological)
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'closeness', 'parallel', 'psychological', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'community', 'parallel', 'psychological', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'status', 'parallel', 'psychological', false) ON CONFLICT (user_id, name) DO NOTHING;

-- Layer 4: Самореализация (parallel / growth)
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'autonomy', 'parallel', 'growth', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'competence', 'parallel', 'growth', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'curiosity', 'parallel', 'growth', false) ON CONFLICT (user_id, name) DO NOTHING;

-- Layer 5: Трансценденция (parallel / integration + expression)
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'meaning', 'parallel', 'integration', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'creativity', 'parallel', 'expression', false) ON CONFLICT (user_id, name) DO NOTHING;
INSERT INTO needs (user_id, name, category, subcategory, is_bridge_node) VALUES (v_user_id, 'play', 'parallel', 'expression', false) ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================
-- 93 метрики (идемпотентно: ON CONFLICT DO NOTHING)
-- ============================================================

-- === sleep (4) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'sleep';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Регулярность сна (sigma времени подъёма, мин)', 'S01', 'core', 'A', 'P2', 0, 120, 0.25, NULL),
  (v_user_id, v_need_id, 'Общее время сна (ч)', 'S02', 'core', 'A', 'P3', 0, 12, 0.25, 7.5),
  (v_user_id, v_need_id, 'Эффективность сна (%)', 'S03', 'core', 'A', 'P1', 0, 100, 0.25, NULL),
  (v_user_id, v_need_id, 'Латентность засыпания (мин)', 'S04', 'extended', 'A', 'P2', 0, 60, 0.25, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === nutrition (8) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'nutrition';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Белок (г/кг)', 'N01', 'core', 'B', 'P3', 0, 3, 0.13, 1.6),
  (v_user_id, v_need_id, 'Баланс калорий (%)', 'N02', 'core', 'B', 'P3', 50, 150, 0.13, 100),
  (v_user_id, v_need_id, 'Терапевтические продукты (%)', 'N03', 'extended', 'D', 'P1', 0, 100, 0.12, NULL),
  (v_user_id, v_need_id, 'Овощи и фрукты (г)', 'N04', 'extended', 'D', 'P3', 0, 800, 0.12, 400),
  (v_user_id, v_need_id, 'АЛТ печени (Ед/л)', 'N05', 'extended', 'C', 'P2', 0, 100, 0.12, NULL),
  (v_user_id, v_need_id, 'Высокочувствительный СРБ (мг/л)', 'N06', 'core', 'C', 'P2', 0, 10, 0.13, NULL),
  (v_user_id, v_need_id, 'HOMA-IR -- инсулинорезистентность', 'N07', 'core', 'C', 'P2', 0, 5, 0.13, NULL),
  (v_user_id, v_need_id, 'Омега-3 индекс (%)', 'N08', 'extended', 'C', 'P1', 0, 15, 0.12, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === movement (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'movement';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'MVPA -- умеренная активность (мин/нед)', 'M01', 'core', 'A', 'P3', 0, 300, 0.17, 150),
  (v_user_id, v_need_id, 'Силовые (сессий/нед)', 'M02', 'core', 'A', 'P3', 0, 7, 0.17, 3),
  (v_user_id, v_need_id, 'Сидячее время (ч/день)', 'M03', 'core', 'A', 'P2', 0, 16, 0.17, NULL),
  (v_user_id, v_need_id, 'Шаги/день', 'M04', 'extended', 'A', 'P1', 0, 20000, 0.17, NULL),
  (v_user_id, v_need_id, 'VO2max (мл/кг*мин)', 'M05', 'core', 'A', 'P1', 20, 70, 0.16, NULL),
  (v_user_id, v_need_id, 'Stand Hours/день', 'M06', 'extended', 'A', 'P1', 0, 12, 0.16, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === health (7) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'health';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'HbA1c -- гликированный гемоглобин (%)', 'H01', 'core', 'C', 'P2', 4, 10, 0.15, NULL),
  (v_user_id, v_need_id, 'ApoB -- аполипопротеин B (мг/дл)', 'H02', 'core', 'C', 'P2', 30, 200, 0.15, NULL),
  (v_user_id, v_need_id, 'Давление систолическое (mmHg)', 'H03', 'core', 'A', 'P2', 90, 180, 0.15, NULL),
  (v_user_id, v_need_id, 'Lp(a) -- липопротеин(а) (мг/дл)', 'H04', 'extended', 'C', 'P2', 0, 200, 0.14, NULL),
  (v_user_id, v_need_id, 'Витамин D 25-OH (нг/мл)', 'H05', 'extended', 'C', 'P3', 10, 100, 0.14, 50),
  (v_user_id, v_need_id, 'Висцеральный жир (шкала 1-30)', 'H06', 'core', 'A', 'P2', 1, 30, 0.14, NULL),
  (v_user_id, v_need_id, 'HRV RMSSD (мс)', 'H07', 'core', 'A', 'P1', 0, 150, 0.13, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === safety (8) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'safety';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Personal Runway (мес)', 'SF01', 'core', 'B', 'P1', 0, 24, 0.13, NULL),
  (v_user_id, v_need_id, 'GAD-7 тревожность (0-21)', 'SF02', 'core', 'D', 'P2', 0, 21, 0.13, NULL),
  (v_user_id, v_need_id, 'Источники дохода', 'SF03', 'extended', 'B', 'P1', 0, 10, 0.12, NULL),
  (v_user_id, v_need_id, 'Burn Rate Trend (%)', 'SF04', 'core', 'B', 'P2', -50, 100, 0.13, NULL),
  (v_user_id, v_need_id, 'Дней до истечения ВНЖ', 'SF05', 'core', 'B', 'P1', 0, 365, 0.13, NULL),
  (v_user_id, v_need_id, 'Социальная поддержка (люди)', 'SF06', 'extended', 'D', 'P1', 0, 10, 0.12, NULL),
  (v_user_id, v_need_id, 'Финансовая дисциплина (%)', 'SF07', 'extended', 'B', 'P1', 0, 100, 0.12, NULL),
  (v_user_id, v_need_id, 'Юридическая готовность (%)', 'SF08', 'extended', 'D', 'P1', 0, 100, 0.12, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === orientation (7) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'orientation';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'IUS-12 непереносимость неопределённости (1-5)', 'OC01', 'extended', 'D', 'P2', 1, 5, 0.14, NULL),
  (v_user_id, v_need_id, 'Pearlin Mastery Scale (7-28)', 'OC02', 'core', 'D', 'P1', 7, 28, 0.15, NULL),
  (v_user_id, v_need_id, 'Незахваченные обязательства', 'OC03', 'core', 'D', 'P2', 0, 50, 0.15, NULL),
  (v_user_id, v_need_id, 'Decision Paralysis/нед', 'OC04', 'extended', 'D', 'P2', 0, 10, 0.14, NULL),
  (v_user_id, v_need_id, 'Горизонт планирования (недель)', 'OC05', 'core', 'D', 'P1', 0, 52, 0.14, NULL),
  (v_user_id, v_need_id, 'Weekly Review (0-4)', 'OC06', 'core', 'D', 'P1', 0, 4, 0.15, NULL),
  (v_user_id, v_need_id, 'Системы функционируют (0-5)', 'OC07', 'extended', 'D', 'P1', 0, 5, 0.13, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === closeness (7) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'closeness';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Качественное время (ч/нед)', 'CB01', 'core', 'D', 'P3', 0, 30, 0.15, 10),
  (v_user_id, v_need_id, 'Доверенные люди', 'CB02', 'core', 'D', 'P1', 0, 10, 0.15, NULL),
  (v_user_id, v_need_id, 'Глубокие разговоры/нед', 'CB03', 'extended', 'D', 'P1', 0, 10, 0.14, NULL),
  (v_user_id, v_need_id, 'ECR-RS безопасность привязанности (1-7)', 'CB04', 'core', 'D', 'P1', 1, 7, 0.15, NULL),
  (v_user_id, v_need_id, 'Физический контакт/нед', 'CB05', 'extended', 'D', 'P1', 0, 14, 0.14, NULL),
  (v_user_id, v_need_id, 'UCLA-3 одиночество (3-9)', 'CB06', 'core', 'D', 'P2', 3, 9, 0.14, NULL),
  (v_user_id, v_need_id, 'RAS удовлетворённость отношениями (0-5)', 'CB07', 'extended', 'D', 'P1', 0, 5, 0.13, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === community (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'community';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Активные сообщества', 'CM01', 'core', 'D', 'P1', 0, 10, 0.17, NULL),
  (v_user_id, v_need_id, 'Участие в группах/мес', 'CM02', 'core', 'D', 'P1', 0, 20, 0.17, NULL),
  (v_user_id, v_need_id, 'Разнообразие типов (из 5)', 'CM03', 'extended', 'D', 'P1', 0, 5, 0.17, NULL),
  (v_user_id, v_need_id, 'Вклад в сообщество/мес', 'CM04', 'extended', 'D', 'P1', 0, 10, 0.17, NULL),
  (v_user_id, v_need_id, 'BSCS чувство сообщества (1-5)', 'CM05', 'core', 'D', 'P1', 1, 5, 0.16, NULL),
  (v_user_id, v_need_id, 'Слабые связи', 'CM06', 'extended', 'D', 'P1', 0, 30, 0.16, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === status (7) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'status';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'RSES самооценка (10-40)', 'ST01', 'core', 'D', 'P1', 10, 40, 0.15, NULL),
  (v_user_id, v_need_id, 'CIPS синдром самозванца (20-100)', 'ST02', 'core', 'D', 'P2', 20, 100, 0.15, NULL),
  (v_user_id, v_need_id, 'Признание/нед', 'ST03', 'extended', 'D', 'P1', 0, 10, 0.14, NULL),
  (v_user_id, v_need_id, 'SCS самосострадание (12-60)', 'ST04', 'core', 'D', 'P1', 12, 60, 0.15, NULL),
  (v_user_id, v_need_id, 'Влияние (1-10)', 'ST05', 'extended', 'D', 'P1', 1, 10, 0.14, NULL),
  (v_user_id, v_need_id, 'Видимость (1-10)', 'ST06', 'extended', 'D', 'P1', 1, 10, 0.14, NULL),
  (v_user_id, v_need_id, 'Репутация (1-10)', 'ST07', 'extended', 'D', 'P1', 1, 10, 0.13, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === autonomy (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'autonomy';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'BPNSFS удовлетворённость автономии (4-20)', 'AU01', 'core', 'D', 'P1', 4, 20, 0.17, NULL),
  (v_user_id, v_need_id, 'Контроль времени и методов (1-10)', 'AU02', 'core', 'D', 'P1', 1, 10, 0.17, NULL),
  (v_user_id, v_need_id, 'Авторство жизни (1-10)', 'AU03', 'extended', 'D', 'P1', 1, 10, 0.17, NULL),
  (v_user_id, v_need_id, 'BPNSFS фрустрация автономии (4-20)', 'AU04', 'extended', 'D', 'P2', 4, 20, 0.17, NULL),
  (v_user_id, v_need_id, 'Жизнь по ценностям (1-10)', 'AU05', 'core', 'D', 'P1', 1, 10, 0.16, NULL),
  (v_user_id, v_need_id, 'Контроль целей/проектов (1-10)', 'AU06', 'extended', 'D', 'P1', 1, 10, 0.16, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === competence (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'competence';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'BPNSFS компетентность (8-40)', 'CP01', 'extended', 'D', 'P1', 8, 40, 0.17, NULL),
  (v_user_id, v_need_id, 'Состояния потока/нед', 'CP02', 'core', 'D', 'P1', 0, 7, 0.17, NULL),
  (v_user_id, v_need_id, 'Осознанная практика (ч/нед)', 'CP03', 'core', 'A', 'P3', 0, 20, 0.17, 10),
  (v_user_id, v_need_id, 'Выполнение обязательств (%)', 'CP04', 'core', 'B', 'P1', 0, 100, 0.17, NULL),
  (v_user_id, v_need_id, 'GSE самоэффективность (10-40)', 'CP05', 'core', 'D', 'P1', 10, 40, 0.16, NULL),
  (v_user_id, v_need_id, 'Баланс вызов-навык (1-10)', 'CP06', 'extended', 'D', 'P3', 1, 10, 0.16, 5)
ON CONFLICT (user_id, code) DO NOTHING;

-- === curiosity (5) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'curiosity';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Активное обучение (ч/нед)', 'CU01', 'core', 'A', 'P3', 0, 20, 0.20, 7),
  (v_user_id, v_need_id, 'Артефакты познания/нед', 'CU02', 'core', 'D', 'P1', 0, 10, 0.20, NULL),
  (v_user_id, v_need_id, 'Новые опыты/нед', 'CU03', 'extended', 'D', 'P1', 0, 5, 0.20, NULL),
  (v_user_id, v_need_id, 'CEI-II любопытство (10-50)', 'CU04', 'core', 'D', 'P1', 10, 50, 0.20, NULL),
  (v_user_id, v_need_id, 'Предвкушение (1-10)', 'CU05', 'extended', 'D', 'P1', 1, 10, 0.20, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === meaning (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'meaning';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'MLQ-P наличие смысла (5-35)', 'ME01', 'core', 'D', 'P1', 5, 35, 0.17, NULL),
  (v_user_id, v_need_id, 'WAMI смысл в работе (1-5)', 'ME02', 'core', 'D', 'P1', 1, 5, 0.17, NULL),
  (v_user_id, v_need_id, 'MLQ-S поиск смысла (5-35)', 'ME03', 'core', 'D', 'P1', 5, 35, 0.17, NULL),
  (v_user_id, v_need_id, 'Значимость жизни (1-10)', 'ME04', 'extended', 'D', 'P1', 1, 10, 0.17, NULL),
  (v_user_id, v_need_id, 'Смысл в трудностях (1-10)', 'ME05', 'extended', 'D', 'P1', 1, 10, 0.16, NULL),
  (v_user_id, v_need_id, 'Понятность жизни (1-10)', 'ME06', 'extended', 'D', 'P1', 1, 10, 0.16, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === creativity (4) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'creativity';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'Творческие артефакты/нед', 'CR01', 'core', 'D', 'P1', 0, 10, 0.25, NULL),
  (v_user_id, v_need_id, 'Аутентичность (1-10)', 'CR02', 'core', 'D', 'P1', 1, 10, 0.25, NULL),
  (v_user_id, v_need_id, 'Выраженные потребности/нед', 'CR03', 'core', 'D', 'P1', 0, 7, 0.25, NULL),
  (v_user_id, v_need_id, 'Творческая самоэффективность (1-10)', 'CR04', 'extended', 'D', 'P1', 1, 10, 0.25, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- === play (6) ===
SELECT id INTO v_need_id FROM needs WHERE user_id = v_user_id AND name = 'play';
INSERT INTO metrics (user_id, need_id, name, code, type, level, scale_type, scale_min, scale_max, weight, scale_target) VALUES
  (v_user_id, v_need_id, 'SPANE-P позитивный опыт (6-30)', 'PL01', 'core', 'D', 'P1', 6, 30, 0.17, NULL),
  (v_user_id, v_need_id, 'REQ-Det психологическое отключение (4-20)', 'PL02', 'core', 'D', 'P1', 4, 20, 0.17, NULL),
  (v_user_id, v_need_id, 'SMAP игривость (5-35)', 'PL03', 'extended', 'D', 'P1', 5, 35, 0.17, NULL),
  (v_user_id, v_need_id, 'Время игры (ч/нед)', 'PL04', 'core', 'D', 'P3', 0, 20, 0.17, 5),
  (v_user_id, v_need_id, 'DUWAS трудоголизм (10-40)', 'PL05', 'core', 'D', 'P2', 10, 40, 0.16, NULL),
  (v_user_id, v_need_id, 'Социальная игра/нед', 'PL06', 'extended', 'D', 'P1', 0, 5, 0.16, NULL)
ON CONFLICT (user_id, code) DO NOTHING;

-- ============================================================
-- Верификация
-- ============================================================
RAISE NOTICE 'Seeded: user=%, needs=%, metrics=%',
  (SELECT COUNT(*) FROM users WHERE id = v_user_id),
  (SELECT COUNT(*) FROM needs WHERE user_id = v_user_id),
  (SELECT COUNT(*) FROM metrics WHERE user_id = v_user_id);

END $$;
