export type MetricType = "core" | "extended";
export type AutomationLevel = "A" | "B" | "C" | "D";
export type ScaleType = "P1" | "P2" | "P3" | "P4";
export type MetricSource = "manual" | "api" | "auto";

export interface Metric {
  id: string;
  user_id: string;
  need_id: string;
  name: string;
  code: string;
  type: MetricType;
  level: AutomationLevel;
  scale_type: ScaleType;
  scale_min: number;
  scale_max: number;
  scale_target?: number;
  scale_threshold?: number;
  weight: number;
}

export interface MetricValue {
  id: string;
  user_id: string;
  metric_id: string;
  value: number;
  normalized_value: number;
  recorded_at: Date;
  source: MetricSource;
}
