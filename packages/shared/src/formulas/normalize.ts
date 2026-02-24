import type { ScaleType } from "../types/metric";
import { clamp } from "./utils";

export type { ScaleType };

export interface P1Config { type: "P1"; min: number; max: number; }
export interface P2Config { type: "P2"; min: number; max: number; }
export interface P3Config { type: "P3"; min: number; max: number; target: number; }
export interface P4Config { type: "P4"; threshold: number; }

export type ScaleConfig = P1Config | P2Config | P3Config | P4Config;

/**
 * Normalize a raw metric value to [0, 100] range.
 * Result is always clamped to [0, 100].
 */
export function normalizeMetric(value: number, config: ScaleConfig): number {
  switch (config.type) {
    case "P1": {
      const range = config.max - config.min;
      if (range === 0) return 0;
      return clamp(((value - config.min) / range) * 100);
    }
    case "P2": {
      const range = config.max - config.min;
      if (range === 0) return 0;
      return clamp(((config.max - value) / range) * 100);
    }
    case "P3": {
      const maxDeviation = Math.max(
        config.target - config.min,
        config.max - config.target,
      );
      if (maxDeviation === 0) return 100;
      const deviation = Math.abs(value - config.target);
      return clamp((1 - deviation / maxDeviation) * 100);
    }
    case "P4": {
      return value >= config.threshold ? 100 : 0;
    }
  }
}
