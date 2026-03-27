export type BrC20Operation = 'deploy' | 'mint' | 'transfer';

export interface BrC20Deploy {
  p: 'brc-20';
  op: 'deploy';
  tick: string;
  max: string;
  lim: string;
  dec: string; // max 18
}

export interface BrC20Mint {
  p: 'brc-20';
  op: 'mint';
  tick: string;
  amt: string;
}

export interface BrC20Transfer {
  p: 'brc-20';
  op: 'transfer';
  tick: string;
  amt: string;
}

export type BrC20Parsed = BrC20Deploy | BrC20Mint | BrC20Transfer;

/**
 * Flaw types for invalid BRC-20 inscriptions (cenotaph-style, same pattern as Rune cenotaphs).
 * A BRC-20 with flaws is structurally recognizable as BRC-20 but invalid.
 */
export type BrC20Flaw =
  | 'missing_ticker'       // tick is missing, empty, or not a string
  | 'ticker_too_long'      // tick exceeds 20 chars (DB column limit)
  | 'missing_max_supply'   // deploy without max
  | 'missing_amount'       // mint/transfer without amt
  | 'invalid_decimals';    // dec not an integer in 0-18

/**
 * Type guard: parses raw content string and returns typed BRC-20 object or null.
 */
export function parseBrc20Content(content: string): BrC20Parsed | null {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    if (parsed?.p !== 'brc-20') {
      return null;
    }

    if (parsed.op === 'deploy' || parsed.op === 'mint' || parsed.op === 'transfer') {
      return parsed as BrC20Parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates a parsed BRC-20 object and returns a list of flaws (cenotaph-style).
 * Empty array = valid BRC-20. Non-empty = cenotaph (parsed but structurally invalid).
 *
 * Follows the same pattern as Rune cenotaphs in the analyser:
 * cenotaphs still get the top-level ordpool_brc20 flag, but operation-specific
 * flags (deploy/mint/transfer) are NOT set, so they don't pollute stats or DB inserts.
 */
export function getBrc20Flaws(parsed: BrC20Parsed): BrC20Flaw[] {
  const flaws: BrC20Flaw[] = [];

  // tick is required for all operations
  if (!parsed.tick || typeof parsed.tick !== 'string' || parsed.tick.trim() === '') {
    flaws.push('missing_ticker');
  } else if (parsed.tick.length > 20) {
    flaws.push('ticker_too_long');
  }

  if (parsed.op === 'deploy') {
    const deploy = parsed as BrC20Deploy;

    // max is required for deploy
    if (!deploy.max || typeof deploy.max !== 'string' || deploy.max.trim() === '') {
      flaws.push('missing_max_supply');
    }

    // dec must be an integer in 0-18 if specified
    if (deploy.dec !== undefined && deploy.dec !== null && deploy.dec !== '') {
      const dec = Number(deploy.dec);
      if (isNaN(dec) || dec < 0 || dec > 18 || !Number.isInteger(dec)) {
        flaws.push('invalid_decimals');
      }
    }
  }

  if (parsed.op === 'mint' || parsed.op === 'transfer') {
    const mintOrTransfer = parsed as BrC20Mint | BrC20Transfer;

    // amt is required for mint and transfer
    if (!mintOrTransfer.amt || typeof mintOrTransfer.amt !== 'string' || mintOrTransfer.amt.trim() === '') {
      flaws.push('missing_amount');
    }
  }

  return flaws;
}
