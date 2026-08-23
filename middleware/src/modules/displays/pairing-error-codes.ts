/**
 * Machine-readable discriminators for the pairing conflicts a client has to
 * tell apart. Same convention as `device-auth-check.service.ts` in this
 * module (`code: 'AUTH_EXPIRED' | ...`).
 *
 * WHY THESE EXIST: the dashboard used to select its copy — and scrape the
 * conflicting display id — out of the English message text. That binds the UI
 * to prose, so rewording a sentence silently changes behaviour, and it means
 * arbitrary backend exception text has to be rendered verbatim to stay useful.
 * These codes are the contract instead. The `message` strings are curated for
 * humans and are still returned unchanged; the client selects its own copy by
 * `statusCode` + `code` and only ever reads structured fields.
 *
 * Thrown in OBJECT form (`new ConflictException({ statusCode, code, ... })`)
 * because `AllExceptionsFilter` returns an object-form `HttpException`
 * response as-is, so these fields reach the client unchanged. Object form also
 * means `statusCode` must be supplied by us — Nest does not merge it in.
 */
export const PAIRING_ERROR_CODES = {
  /** An unrelated new-display pairing is mid-completion for this org. */
  ORG_PAIRING_IN_PROGRESS: 'ORG_PAIRING_IN_PROGRESS',
  /** This same display is already being re-paired by another request. */
  DISPLAY_REBIND_IN_PROGRESS: 'DISPLAY_REBIND_IN_PROGRESS',
  /**
   * Another row in the SAME org already holds the device identifier. Carries
   * `conflictingDisplayId`, because the remedy is to deal with that row first.
   */
  DEVICE_IDENTIFIER_IN_USE: 'DEVICE_IDENTIFIER_IN_USE',
  /**
   * The identifier was free at the read and taken before the write. No id is
   * carried: the winner is not known here, and guessing one would be worse
   * than saying nothing.
   */
  DEVICE_IDENTIFIER_TAKEN_DURING_REBIND: 'DEVICE_IDENTIFIER_TAKEN_DURING_REBIND',
} as const;

export type PairingErrorCode =
  (typeof PAIRING_ERROR_CODES)[keyof typeof PAIRING_ERROR_CODES];
