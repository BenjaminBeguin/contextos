/**
 * Redact secrets from memory text. Memmo stores durable, shareable knowledge;
 * memories must never carry credentials, tokens, or connection strings. This is
 * a deterministic safety net applied to every memory write, independent of how
 * the memory was produced (LLM extraction, propose_memories, scan, or manual).
 *
 * It is intentionally conservative about STRUCTURED secrets (assignments, URLs,
 * known token shapes). Keeping memories free of environment-specific config
 * (ports, hostnames, local paths) is handled upstream by the extraction prompt,
 * since that's a content-quality judgement rather than a pattern.
 */

const REDACTED = "[redacted]";

const PATTERNS: [RegExp, string][] = [
  // Private key blocks.
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g, REDACTED],
  // Credentials embedded in a URL: scheme://user:secret@host → scheme://user:[redacted]@host
  [/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+(@)/gi, `$1${REDACTED}$2`],
  // KEY=VALUE / KEY: VALUE where KEY names a secret (optionally quoted value).
  [
    /\b([A-Za-z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|AUTH)[A-Za-z0-9_]*)(\s*[:=]\s*)(["']?)[^\s"']+\3/gi,
    `$1$2${REDACTED}`,
  ],
  // Authorization: Bearer <token>
  [/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/g, `$1 ${REDACTED}`],
  // Well-known token shapes (Memmo, GitHub, OpenAI, Slack, Stripe, Google).
  [/\b(?:memmo_|ghp_|gho_|ghs_|github_pat_|sk-[a-zA-Z]*-|xox[baprs]-|AIza)[A-Za-z0-9._-]{8,}/g, REDACTED],
  // AWS access key id.
  [/\bAKIA[0-9A-Z]{16}\b/g, REDACTED],
];

/** Return `text` with structured secrets replaced by a redaction marker. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}
