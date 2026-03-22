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
