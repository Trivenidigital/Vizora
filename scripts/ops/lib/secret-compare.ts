/**
 * Vizora Autonomous Operations — secret comparison
 *
 * Extracted from `config-drift.ts` so low-level modules can compare secrets
 * without importing the whole drift-analysis chain (which imports middleware's
 * Zod validator). `config-drift.ts` re-exports both symbols, so its public
 * surface is unchanged.
 *
 * The B1 ruling on secrets applies to everything here: compare in memory,
 * return ONLY a state token, and never let a value or any derivation of one —
 * including a fingerprint — reach a log, an alert, or ops-state.json.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export type SecretVerdict = 'MATCH' | 'DRIFT' | 'BOTH_ABSENT' | 'ONE_ABSENT';

/**
 * Compare two secrets in memory and return ONLY a state token.
 *
 * Both operands are hashed to fixed-length digests so the comparison is
 * constant-time and length-independent; the digests are internal and are never
 * returned, logged, persisted or transmitted. Nothing derived from either value
 * escapes this function.
 */
export function compareSecretValues(a: string | undefined, b: string | undefined): SecretVerdict {
  const aSet = a !== undefined && a !== null;
  const bSet = b !== undefined && b !== null;
  if (!aSet && !bSet) return 'BOTH_ABSENT';
  if (aSet !== bSet) return 'ONE_ABSENT';

  const da = createHash('sha256').update(a as string, 'utf8').digest();
  const db = createHash('sha256').update(b as string, 'utf8').digest();
  return timingSafeEqual(da, db) ? 'MATCH' : 'DRIFT';
}
