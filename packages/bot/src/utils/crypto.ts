import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Hashes both inputs before comparison to avoid leaking length.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
