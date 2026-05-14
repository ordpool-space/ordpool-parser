import { DigitalArtifact } from "./digital-artifact";

export interface ParsedSrc20 extends DigitalArtifact {

  /**
   * Returns decoded SRC-20 JSON data
   */
  getContent: () => string;
}

// -- Structured types for SRC-20 content validation --

export type Src20Operation = 'deploy' | 'mint' | 'transfer';

// Numeric fields on SRC-20 may be encoded as a JSON string OR a JSON number.
// The canonical spec lists both forms as valid -- see the parser docs link in
// `src20-parser.service.ts` (stampchain-io/stamps_sdk/docs/src20specs.md,
// "Valid Examples"):
//   {"p":"src-20","op":"mint","tick":"X","amt":"100"}   <- string-form
//   {"p":"src-20","op":"mint","tick":"X","amt":100}     <- number-form
// "Only numeric values are allowed in the 'max', 'amt', 'lim' fields" --
// the spec means the VALUE must be numeric; JSON quoting is irrelevant.
// (This is the SRC-20 / BRC-20 divergence: BRC-20 enforces string-only.)
export type Src20Numeric = string | number;

export interface Src20Deploy {
  p: 'src-20';
  op: 'deploy';
  tick: string;
  max: Src20Numeric;
  lim: Src20Numeric;
  dec?: Src20Numeric;
}

export interface Src20Mint {
  p: 'src-20';
  op: 'mint';
  tick: string;
  amt: Src20Numeric;
}

export interface Src20Transfer {
  p: 'src-20';
  op: 'transfer';
  tick: string;
  amt: Src20Numeric;
}

export type Src20Parsed = Src20Deploy | Src20Mint | Src20Transfer;

/**
 * Flaw types for invalid SRC-20 transactions (cenotaph-style, same pattern as Rune cenotaphs).
 */
export type Src20Flaw =
  | 'missing_ticker'
  | 'ticker_too_long'      // > 20 chars (DB column limit)
  | 'missing_max_supply'   // deploy without max
  | 'missing_mint_limit'   // deploy without lim (required for SRC-20, unlike BRC-20)
  | 'missing_amount'       // mint/transfer without amt
  | 'invalid_decimals';    // dec not an integer in 0-18

/**
 * Parses raw SRC-20 JSON content string into a typed object.
 * Returns null if the content is not valid SRC-20 JSON structure.
 *
 * This is the SRC-20 equivalent of parseBrc20Content() -- liberal parsing
 * that accepts anything with p:'src-20' and a valid op, then lets
 * getSrc20Flaws() decide if the content is actually usable.
 */
export function parseSrc20Content(content: string): Src20Parsed | null {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    if (parsed?.p !== 'src-20') {
      return null;
    }

    if (parsed.op === 'deploy' || parsed.op === 'mint' || parsed.op === 'transfer') {
      return parsed as Src20Parsed;
    }

    return null;
  } catch {
    return null;
  }
}

// Canonical numeric regex from stampchain-io/btc_stamps
// (indexer/src/index_core/src20.py:29). Matches what their indexer accepts
// for `amt`, `max`, `lim`: digits, optional decimal point + more digits.
// No minus sign, no scientific notation, no garbage. Empty string fails.
const SRC20_NUMERIC_REGEX = /^[0-9]+(\.[0-9]*)?$/;

// uint64 maximum (2^64 - 1). Canonical rejects values outside [0, uint64_max]
// per index_core/src20.py:721.
const SRC20_UINT64_MAX = 18446744073709551615n;

/**
 * True when `v` is a valid SRC-20 numeric: either a JSON string matching
 * /^[0-9]+(\.[0-9]*)?$/ or a JSON number that stringifies to that same
 * pattern. Value must fall in [0, 2^64-1]. Mirrors the canonical indexer's
 * NUMERIC_REGEX + range check (index_core/src20.py:76, 721).
 */
function isCanonicalSrc20Numeric(v: unknown): boolean {
  let str: string;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      return false;
    }
    // Reject negatives, NaN/Infinity, and scientific notation. JS's
    // Number->string conversion produces '1e+21' for large numbers, which
    // the regex correctly rejects.
    str = String(v);
  } else if (typeof v === 'string') {
    str = v;
  } else {
    return false;
  }

  if (!SRC20_NUMERIC_REGEX.test(str)) {
    return false;
  }

  // Range check against uint64 max. Use BigInt on the integer part since
  // strings like '12345.67' would overflow Number.parseFloat for huge
  // numbers; canonical only cares about the integer portion for the
  // range check anyway (decimals are bounded by `dec`).
  const integerPart = str.split('.')[0];
  try {
    return BigInt(integerPart) <= SRC20_UINT64_MAX;
  } catch {
    return false;
  }
}

/**
 * Validates a parsed SRC-20 object and returns a list of flaws (cenotaph-style).
 * Empty array = valid SRC-20. Non-empty = cenotaph (parsed but structurally invalid).
 */
export function getSrc20Flaws(parsed: Src20Parsed): Src20Flaw[] {
  const flaws: Src20Flaw[] = [];

  // tick is required for all operations
  if (!parsed.tick || typeof parsed.tick !== 'string' || parsed.tick.trim() === '') {
    flaws.push('missing_ticker');
  } else if (parsed.tick.length > 20) {
    flaws.push('ticker_too_long');
  }

  if (parsed.op === 'deploy') {
    const deploy = parsed as Src20Deploy;

    if (!isCanonicalSrc20Numeric(deploy.max)) {
      flaws.push('missing_max_supply');
    }

    // lim is required for SRC-20 deploy (unlike BRC-20 where it's optional).
    if (!isCanonicalSrc20Numeric(deploy.lim)) {
      flaws.push('missing_mint_limit');
    }

    // dec is optional; empty string / null / undefined => spec default of 18.
    // When specified, must be an integer in [0, 18].
    if (deploy.dec !== undefined && deploy.dec !== null && deploy.dec !== '') {
      const dec = Number(deploy.dec);
      if (isNaN(dec) || dec < 0 || dec > 18 || !Number.isInteger(dec)) {
        flaws.push('invalid_decimals');
      }
    }
  }

  if (parsed.op === 'mint' || parsed.op === 'transfer') {
    const mintOrTransfer = parsed as Src20Mint | Src20Transfer;

    if (!isCanonicalSrc20Numeric(mintOrTransfer.amt)) {
      flaws.push('missing_amount');
    }
  }

  return flaws;
}

