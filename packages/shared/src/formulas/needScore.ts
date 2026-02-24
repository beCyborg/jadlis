import { clamp } from "./utils";

export interface WeightedValue {
  value: number;
  weight: number;
}

/**
 * Calculate NeedScore for a set of weighted, normalized metric values.
 * Formula: (WeightedMean - 0.15 * CV_score) * FloorPenalty
 *
 * @param inputs - array of {value, weight}, value 0-100, weights sum to 1
 * @returns score 0-100
 */
export function calculateNeedScore(inputs: WeightedValue[]): number {
  if (inputs.length === 0) return 0;

  const validInputs = inputs.filter((i) => i.weight > 0);
  if (validInputs.length === 0) return 0;

  const totalWeight = validInputs.reduce((sum, i) => sum + i.weight, 0);

  const mean = calcWeightedMean(validInputs, totalWeight);
  const stddev = calcWeightedStdDev(validInputs, mean, totalWeight);
  const cv = mean > 0 ? stddev / mean : 0;
  const cvScore = cv * 100;
  const floorPenalty = calcFloorPenalty(validInputs.map((i) => i.value));

  const raw = (mean - 0.15 * cvScore) * floorPenalty;
  return clamp(raw);
}

function calcWeightedMean(
  inputs: WeightedValue[],
  totalWeight: number,
): number {
  return inputs.reduce((sum, i) => sum + i.value * i.weight, 0) / totalWeight;
}

function calcWeightedStdDev(
  inputs: WeightedValue[],
  mean: number,
  totalWeight: number,
): number {
  const variance =
    inputs.reduce((sum, i) => sum + i.weight * (i.value - mean) ** 2, 0) /
    totalWeight;
  return Math.sqrt(Math.max(0, variance));
}

function calcFloorPenalty(values: number[], threshold = 20): number {
  const minValue = Math.min(...values);
  if (minValue >= threshold) return 1.0;
  return 0.5 + 0.5 * (minValue / threshold);
}
