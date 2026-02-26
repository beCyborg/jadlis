/**
 * Clamp a value to the [0, 100] range.
 */
export function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Validate an IANA timezone string using Intl.DateTimeFormat.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
