/**
 * Parses raw JSON content for any stamps-family / inscription-family protocol
 * with a `p` discriminator field and an `op` operation field. Returns the
 * parsed object if `p` matches `protocolId` and `op` is one of `allowedOps`;
 * otherwise null.
 *
 * Shared skeleton used by parseBrc20Content / parseSrc20Content /
 * parseSrc721Content / parseSrc101Content -- they all need exactly this:
 * type-check, JSON.parse-with-trim, `p` match, `op` whitelist.
 *
 * Liberal parsing: callers run their own getXxxFlaws() afterwards to enforce
 * per-protocol field rules.
 */
export function parseProtocolJson<T>(
  content: string,
  protocolId: string,
  allowedOps: readonly string[],
): T | null {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    if (parsed?.p !== protocolId) {
      return null;
    }

    if (allowedOps.includes(parsed.op)) {
      return parsed as T;
    }

    return null;
  } catch {
    return null;
  }
}
