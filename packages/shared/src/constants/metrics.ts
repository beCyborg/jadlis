import type { AutomationLevel, MetricType, ScaleType } from "../types/metric";
import type { NeedName } from "../types/need";

export interface MetricDefinition {
  code: string;
  name: string;
  need_name: NeedName;
  type: MetricType;
  level: AutomationLevel;
  scale_type: ScaleType;
  scale_min: number;
  scale_max: number;
  scale_target?: number;
  scale_threshold?: number;
  weight: number;
}

export const ALL_METRICS: MetricDefinition[] = [
  // ═══════════════════════════════════════════════════════════
  // Layer 1: Физиология
  // ═══════════════════════════════════════════════════════════

  // === 1.1 СОН (sleep) — 4 метрики ===
  { code: "S01", name: "Регулярность сна (σ времени подъёма, мин)", need_name: "sleep", type: "core", level: "A", scale_type: "P2", scale_min: 0, scale_max: 120, weight: 0.25 },
  { code: "S02", name: "Общее время сна (ч)", need_name: "sleep", type: "core", level: "A", scale_type: "P3", scale_min: 0, scale_max: 12, scale_target: 7.5, weight: 0.25 },
  { code: "S03", name: "Эффективность сна (%)", need_name: "sleep", type: "core", level: "A", scale_type: "P1", scale_min: 0, scale_max: 100, weight: 0.25 },
  { code: "S04", name: "Латентность засыпания (мин)", need_name: "sleep", type: "extended", level: "A", scale_type: "P2", scale_min: 0, scale_max: 60, weight: 0.25 },

  // === 1.2 ПИТАНИЕ (nutrition) — 8 метрик ===
  { code: "N01", name: "Белок (г/кг)", need_name: "nutrition", type: "core", level: "B", scale_type: "P3", scale_min: 0, scale_max: 3, scale_target: 1.6, weight: 0.13 },
  { code: "N02", name: "Баланс калорий (%)", need_name: "nutrition", type: "core", level: "B", scale_type: "P3", scale_min: 50, scale_max: 150, scale_target: 100, weight: 0.13 },
  { code: "N03", name: "Терапевтические продукты (%)", need_name: "nutrition", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 100, weight: 0.12 },
  { code: "N04", name: "Овощи и фрукты (г)", need_name: "nutrition", type: "extended", level: "D", scale_type: "P3", scale_min: 0, scale_max: 800, scale_target: 400, weight: 0.12 },
  { code: "N05", name: "АЛТ печени (Ед/л)", need_name: "nutrition", type: "extended", level: "C", scale_type: "P2", scale_min: 0, scale_max: 100, weight: 0.12 },
  { code: "N06", name: "Высокочувствительный СРБ (мг/л)", need_name: "nutrition", type: "core", level: "C", scale_type: "P2", scale_min: 0, scale_max: 10, weight: 0.13 },
  { code: "N07", name: "HOMA-IR — инсулинорезистентность", need_name: "nutrition", type: "core", level: "C", scale_type: "P2", scale_min: 0, scale_max: 5, weight: 0.13 },
  { code: "N08", name: "Омега-3 индекс (%)", need_name: "nutrition", type: "extended", level: "C", scale_type: "P1", scale_min: 0, scale_max: 15, weight: 0.12 },

  // === 1.3 ДВИЖЕНИЕ (movement) — 6 метрик ===
  { code: "M01", name: "MVPA — умеренная активность (мин/нед)", need_name: "movement", type: "core", level: "A", scale_type: "P3", scale_min: 0, scale_max: 300, scale_target: 150, weight: 0.17 },
  { code: "M02", name: "Силовые (сессий/нед)", need_name: "movement", type: "core", level: "A", scale_type: "P3", scale_min: 0, scale_max: 7, scale_target: 3, weight: 0.17 },
  { code: "M03", name: "Сидячее время (ч/день)", need_name: "movement", type: "core", level: "A", scale_type: "P2", scale_min: 0, scale_max: 16, weight: 0.17 },
  { code: "M04", name: "Шаги/день", need_name: "movement", type: "extended", level: "A", scale_type: "P1", scale_min: 0, scale_max: 20000, weight: 0.17 },
  { code: "M05", name: "VO2max (мл/кг·мин)", need_name: "movement", type: "core", level: "A", scale_type: "P1", scale_min: 20, scale_max: 70, weight: 0.16 },
  { code: "M06", name: "Stand Hours/день", need_name: "movement", type: "extended", level: "A", scale_type: "P1", scale_min: 0, scale_max: 12, weight: 0.16 },

  // === 1.4 ЗДОРОВЬЕ (health) — 7 метрик ===
  { code: "H01", name: "HbA1c — гликированный гемоглобин (%)", need_name: "health", type: "core", level: "C", scale_type: "P2", scale_min: 4, scale_max: 10, weight: 0.15 },
  { code: "H02", name: "ApoB — аполипопротеин B (мг/дл)", need_name: "health", type: "core", level: "C", scale_type: "P2", scale_min: 30, scale_max: 200, weight: 0.15 },
  { code: "H03", name: "Давление систолическое (mmHg)", need_name: "health", type: "core", level: "A", scale_type: "P2", scale_min: 90, scale_max: 180, weight: 0.15 },
  { code: "H04", name: "Lp(a) — липопротеин(а) (мг/дл)", need_name: "health", type: "extended", level: "C", scale_type: "P2", scale_min: 0, scale_max: 200, weight: 0.14 },
  { code: "H05", name: "Витамин D 25-OH (нг/мл)", need_name: "health", type: "extended", level: "C", scale_type: "P3", scale_min: 10, scale_max: 100, scale_target: 50, weight: 0.14 },
  { code: "H06", name: "Висцеральный жир (шкала 1-30)", need_name: "health", type: "core", level: "A", scale_type: "P2", scale_min: 1, scale_max: 30, weight: 0.14 },
  { code: "H07", name: "HRV RMSSD (мс)", need_name: "health", type: "core", level: "A", scale_type: "P1", scale_min: 0, scale_max: 150, weight: 0.13 },

  // ═══════════════════════════════════════════════════════════
  // Layer 2: Безопасность
  // ═══════════════════════════════════════════════════════════

  // === 2.1 БЕЗОПАСНОСТЬ (safety) — 8 метрик ===
  { code: "SF01", name: "Personal Runway (мес)", need_name: "safety", type: "core", level: "B", scale_type: "P1", scale_min: 0, scale_max: 24, weight: 0.13 },
  { code: "SF02", name: "GAD-7 тревожность (0-21)", need_name: "safety", type: "core", level: "D", scale_type: "P2", scale_min: 0, scale_max: 21, weight: 0.13 },
  { code: "SF03", name: "Источники дохода", need_name: "safety", type: "extended", level: "B", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.12 },
  { code: "SF04", name: "Burn Rate Trend (%)", need_name: "safety", type: "core", level: "B", scale_type: "P2", scale_min: -50, scale_max: 100, weight: 0.13 },
  { code: "SF05", name: "Дней до истечения ВНЖ", need_name: "safety", type: "core", level: "B", scale_type: "P1", scale_min: 0, scale_max: 365, weight: 0.13 },
  { code: "SF06", name: "Социальная поддержка (люди)", need_name: "safety", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.12 },
  { code: "SF07", name: "Финансовая дисциплина (%)", need_name: "safety", type: "extended", level: "B", scale_type: "P1", scale_min: 0, scale_max: 100, weight: 0.12 },
  { code: "SF08", name: "Юридическая готовность (%)", need_name: "safety", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 100, weight: 0.12 },

  // === 2.2 ОРИЕНТАЦИЯ И КОНТРОЛЬ (orientation) — 7 метрик ===
  { code: "OC01", name: "IUS-12 непереносимость неопределённости (1-5)", need_name: "orientation", type: "extended", level: "D", scale_type: "P2", scale_min: 1, scale_max: 5, weight: 0.14 },
  { code: "OC02", name: "Pearlin Mastery Scale (7-28)", need_name: "orientation", type: "core", level: "D", scale_type: "P1", scale_min: 7, scale_max: 28, weight: 0.15 },
  { code: "OC03", name: "Незахваченные обязательства", need_name: "orientation", type: "core", level: "D", scale_type: "P2", scale_min: 0, scale_max: 50, weight: 0.15 },
  { code: "OC04", name: "Decision Paralysis/нед", need_name: "orientation", type: "extended", level: "D", scale_type: "P2", scale_min: 0, scale_max: 10, weight: 0.14 },
  { code: "OC05", name: "Горизонт планирования (недель)", need_name: "orientation", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 52, weight: 0.14 },
  { code: "OC06", name: "Weekly Review (0-4)", need_name: "orientation", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 4, weight: 0.15 },
  { code: "OC07", name: "Системы функционируют (0-5)", need_name: "orientation", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 5, weight: 0.13 },

  // ═══════════════════════════════════════════════════════════
  // Layer 3: Принадлежность
  // ═══════════════════════════════════════════════════════════

  // === 3.1 БЛИЗОСТЬ (closeness) — 7 метрик ===
  { code: "CB01", name: "Качественное время (ч/нед)", need_name: "closeness", type: "core", level: "D", scale_type: "P3", scale_min: 0, scale_max: 30, scale_target: 10, weight: 0.15 },
  { code: "CB02", name: "Доверенные люди", need_name: "closeness", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.15 },
  { code: "CB03", name: "Глубокие разговоры/нед", need_name: "closeness", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.14 },
  { code: "CB04", name: "ECR-RS безопасность привязанности (1-7)", need_name: "closeness", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 7, weight: 0.15 },
  { code: "CB05", name: "Физический контакт/нед", need_name: "closeness", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 14, weight: 0.14 },
  { code: "CB06", name: "UCLA-3 одиночество (3-9)", need_name: "closeness", type: "core", level: "D", scale_type: "P2", scale_min: 3, scale_max: 9, weight: 0.14 },
  { code: "CB07", name: "RAS удовлетворённость отношениями (0-5)", need_name: "closeness", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 5, weight: 0.13 },

  // === 3.2 СООБЩЕСТВО (community) — 6 метрик ===
  { code: "CM01", name: "Активные сообщества", need_name: "community", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.17 },
  { code: "CM02", name: "Участие в группах/мес", need_name: "community", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 20, weight: 0.17 },
  { code: "CM03", name: "Разнообразие типов (из 5)", need_name: "community", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 5, weight: 0.17 },
  { code: "CM04", name: "Вклад в сообщество/мес", need_name: "community", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.17 },
  { code: "CM05", name: "BSCS чувство сообщества (1-5)", need_name: "community", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 5, weight: 0.16 },
  { code: "CM06", name: "Слабые связи", need_name: "community", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 30, weight: 0.16 },

  // === 3.3 СТАТУС (status) — 7 метрик ===
  { code: "ST01", name: "RSES самооценка (10-40)", need_name: "status", type: "core", level: "D", scale_type: "P1", scale_min: 10, scale_max: 40, weight: 0.15 },
  { code: "ST02", name: "CIPS синдром самозванца (20-100)", need_name: "status", type: "core", level: "D", scale_type: "P2", scale_min: 20, scale_max: 100, weight: 0.15 },
  { code: "ST03", name: "Признание/нед", need_name: "status", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.14 },
  { code: "ST04", name: "SCS самосострадание (12-60)", need_name: "status", type: "core", level: "D", scale_type: "P1", scale_min: 12, scale_max: 60, weight: 0.15 },
  { code: "ST05", name: "Влияние (1-10)", need_name: "status", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.14 },
  { code: "ST06", name: "Видимость (1-10)", need_name: "status", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.14 },
  { code: "ST07", name: "Репутация (1-10)", need_name: "status", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.13 },

  // ═══════════════════════════════════════════════════════════
  // Layer 4: Самореализация
  // ═══════════════════════════════════════════════════════════

  // === 4.1 АВТОНОМИЯ (autonomy) — 6 метрик ===
  { code: "AU01", name: "BPNSFS удовлетворённость автономии (4-20)", need_name: "autonomy", type: "core", level: "D", scale_type: "P1", scale_min: 4, scale_max: 20, weight: 0.17 },
  { code: "AU02", name: "Контроль времени и методов (1-10)", need_name: "autonomy", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.17 },
  { code: "AU03", name: "Авторство жизни (1-10)", need_name: "autonomy", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.17 },
  { code: "AU04", name: "BPNSFS фрустрация автономии (4-20)", need_name: "autonomy", type: "extended", level: "D", scale_type: "P2", scale_min: 4, scale_max: 20, weight: 0.17 },
  { code: "AU05", name: "Жизнь по ценностям (1-10)", need_name: "autonomy", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.16 },
  { code: "AU06", name: "Контроль целей/проектов (1-10)", need_name: "autonomy", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.16 },

  // === 4.2 КОМПЕТЕНТНОСТЬ (competence) — 6 метрик ===
  { code: "CP01", name: "BPNSFS компетентность (8-40)", need_name: "competence", type: "extended", level: "D", scale_type: "P1", scale_min: 8, scale_max: 40, weight: 0.17 },
  { code: "CP02", name: "Состояния потока/нед", need_name: "competence", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 7, weight: 0.17 },
  { code: "CP03", name: "Осознанная практика (ч/нед)", need_name: "competence", type: "core", level: "A", scale_type: "P3", scale_min: 0, scale_max: 20, scale_target: 10, weight: 0.17 },
  { code: "CP04", name: "Выполнение обязательств (%)", need_name: "competence", type: "core", level: "B", scale_type: "P1", scale_min: 0, scale_max: 100, weight: 0.17 },
  { code: "CP05", name: "GSE самоэффективность (10-40)", need_name: "competence", type: "core", level: "D", scale_type: "P1", scale_min: 10, scale_max: 40, weight: 0.16 },
  { code: "CP06", name: "Баланс вызов-навык (1-10)", need_name: "competence", type: "extended", level: "D", scale_type: "P3", scale_min: 1, scale_max: 10, scale_target: 5, weight: 0.16 },

  // === 4.3 ПОЗНАНИЕ (curiosity) — 5 метрик ===
  { code: "CU01", name: "Активное обучение (ч/нед)", need_name: "curiosity", type: "core", level: "A", scale_type: "P3", scale_min: 0, scale_max: 20, scale_target: 7, weight: 0.20 },
  { code: "CU02", name: "Артефакты познания/нед", need_name: "curiosity", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.20 },
  { code: "CU03", name: "Новые опыты/нед", need_name: "curiosity", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 5, weight: 0.20 },
  { code: "CU04", name: "CEI-II любопытство (10-50)", need_name: "curiosity", type: "core", level: "D", scale_type: "P1", scale_min: 10, scale_max: 50, weight: 0.20 },
  { code: "CU05", name: "Предвкушение (1-10)", need_name: "curiosity", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.20 },

  // ═══════════════════════════════════════════════════════════
  // Layer 5: Трансценденция
  // ═══════════════════════════════════════════════════════════

  // === 5.1 СМЫСЛ (meaning) — 6 метрик ===
  { code: "ME01", name: "MLQ-P наличие смысла (5-35)", need_name: "meaning", type: "core", level: "D", scale_type: "P1", scale_min: 5, scale_max: 35, weight: 0.17 },
  { code: "ME02", name: "WAMI смысл в работе (1-5)", need_name: "meaning", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 5, weight: 0.17 },
  { code: "ME03", name: "MLQ-S поиск смысла (5-35)", need_name: "meaning", type: "core", level: "D", scale_type: "P1", scale_min: 5, scale_max: 35, weight: 0.17 },
  { code: "ME04", name: "Значимость жизни (1-10)", need_name: "meaning", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.17 },
  { code: "ME05", name: "Смысл в трудностях (1-10)", need_name: "meaning", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.16 },
  { code: "ME06", name: "Понятность жизни (1-10)", need_name: "meaning", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.16 },

  // === 5.2 ТВОРЧЕСТВО (creativity) — 4 метрики ===
  { code: "CR01", name: "Творческие артефакты/нед", need_name: "creativity", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 10, weight: 0.25 },
  { code: "CR02", name: "Аутентичность (1-10)", need_name: "creativity", type: "core", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.25 },
  { code: "CR03", name: "Выраженные потребности/нед", need_name: "creativity", type: "core", level: "D", scale_type: "P1", scale_min: 0, scale_max: 7, weight: 0.25 },
  { code: "CR04", name: "Творческая самоэффективность (1-10)", need_name: "creativity", type: "extended", level: "D", scale_type: "P1", scale_min: 1, scale_max: 10, weight: 0.25 },

  // === 5.3 ИГРА (play) — 6 метрик ===
  { code: "PL01", name: "SPANE-P позитивный опыт (6-30)", need_name: "play", type: "core", level: "D", scale_type: "P1", scale_min: 6, scale_max: 30, weight: 0.17 },
  { code: "PL02", name: "REQ-Det психологическое отключение (4-20)", need_name: "play", type: "core", level: "D", scale_type: "P1", scale_min: 4, scale_max: 20, weight: 0.17 },
  { code: "PL03", name: "SMAP игривость (5-35)", need_name: "play", type: "extended", level: "D", scale_type: "P1", scale_min: 5, scale_max: 35, weight: 0.17 },
  { code: "PL04", name: "Время игры (ч/нед)", need_name: "play", type: "core", level: "D", scale_type: "P3", scale_min: 0, scale_max: 20, scale_target: 5, weight: 0.17 },
  { code: "PL05", name: "DUWAS трудоголизм (10-40)", need_name: "play", type: "core", level: "D", scale_type: "P2", scale_min: 10, scale_max: 40, weight: 0.16 },
  { code: "PL06", name: "Социальная игра/нед", need_name: "play", type: "extended", level: "D", scale_type: "P1", scale_min: 0, scale_max: 5, weight: 0.16 },
];

export const METRIC_CODES = new Map(ALL_METRICS.map((m) => [m.code, m]));
