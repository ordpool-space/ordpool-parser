import { DigitalArtifact } from "./digital-artifact";

export interface ParsedSrc20 extends DigitalArtifact {

  /**
   * Returns decoded SRC-20 JSON data
   */
  getContent: () => string;
}

// -- Structured types for SRC-20 content validation --

export type Src20Operation = 'deploy' | 'mint' | 'transfer';

export interface Src20Deploy {
  p: 'src-20';
  op: 'deploy';
  tick: string;
  max: string;
  lim: string;
  dec?: string;
}

export interface Src20Mint {
  p: 'src-20';
  op: 'mint';
  tick: string;
  amt: string;
}

export interface Src20Transfer {
  p: 'src-20';
  op: 'transfer';
  tick: string;
  amt: string;
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

    // max is required for deploy
    if (!deploy.max || typeof deploy.max !== 'string' || deploy.max.trim() === '') {
      flaws.push('missing_max_supply');
    }

    // lim is required for SRC-20 deploy (unlike BRC-20 where it's optional)
    if (!deploy.lim || typeof deploy.lim !== 'string' || deploy.lim.trim() === '') {
      flaws.push('missing_mint_limit');
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
    const mintOrTransfer = parsed as Src20Mint | Src20Transfer;

    // amt is required for mint and transfer
    if (!mintOrTransfer.amt || typeof mintOrTransfer.amt !== 'string' || mintOrTransfer.amt.trim() === '') {
      flaws.push('missing_amount');
    }
  }

  return flaws;
}

