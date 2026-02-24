const ALPHA = 0.3;

/**
 * Calculate new EWMA momentum value.
 * M_new = α × X + (1 - α) × M_old
 *
 * @param completed - 1 if completed, 0 if missed
 * @param previousMomentum - previous momentum value (0-100)
 * @returns new momentum value (0-100)
 */
export function calculateEWMA(
  completed: 0 | 1,
  previousMomentum: number,
): number {
  const raw = ALPHA * (completed * 100) + (1 - ALPHA) * previousMomentum;
  return Math.max(0, Math.min(100, raw));
}
