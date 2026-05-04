/**
 * Recursive redaction of secret/PII fields before audit-logging tool inputs.
 *
 * Mirrors the anchored regex in `AgentStateService.FORBIDDEN_KEY_REGEX`
 * (PR #32, R4-HIGH1) so MCP audit logs apply the exact same secret/PII
 * policy as the agent-state I/O surface. Anchored on `^...$/i` — only
 * EXACT key matches are redacted; `apiToken` / `clientSecret` / `key` /
 * `authorType` are intentionally NOT redacted (they were false-positive
 * substring matches in the older unanchored regex this regex replaced).
 */
const FORBIDDEN_KEY_REGEX =
  /^(token|secret|password|passphrase|apiKey|api_key|webhook|webhookUrl|jwt|credential|cookie|sessionId|session_token|privateKey|private_key|accessToken|access_token|refreshToken|refresh_token|authHeader|authorization|email|emailAddress|recipient|phone|phoneNumber|address|fullName)$/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_REGEX.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
