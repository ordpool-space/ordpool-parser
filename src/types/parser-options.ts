/**
 * Optional callback for parser errors.
 * By default, parsers silently return null/[] on errors.
 * Provide this callback to capture parsing failures for debugging.
 */
export type OnParseError = (error: unknown) => void;
