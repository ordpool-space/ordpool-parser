/**
 * Best-effort error-message extraction for arbitrary thrown values.
 *
 * Most JS code throws Error subclasses, but `throw 'plain string'` and
 * `throw { code: ... }` are both legal. This util normalises whatever
 * came out of a `catch` to a printable string without crashing on
 * weird inputs (e.g. circular references in a thrown object).
 *
 * @example
 *   try { ... } catch (e) { console.error(errString(e)); }
 */
export function errString(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return String(e); } catch { return 'unknown error'; }
}
