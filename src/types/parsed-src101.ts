import { DigitalArtifact } from './digital-artifact';

/**
 * SRC-101: Bitcoin Name Service (Bitname) on Bitcoin Stamps.
 *
 * SRC-101 registers and manages domain names on Bitcoin L1.
 * Encoded via OLGA P2WSH (raw JSON in P2WSH outputs).
 *
 * First appeared at block 870,652.
 */
export interface ParsedSrc101 extends DigitalArtifact {

  /**
   * The raw JSON content string.
   */
  getContent: () => string;
}

// -- Structured types for SRC-101 content validation --

// Canonical ops per stampchain-io/btc_stamps src101.py (handle_deploy /
// handle_mint / handle_transfer / handle_renew / handle_setrecord). The
// dispatcher uppercases before comparing; we accept lowercase only to match
// our SRC-20 / SRC-721 convention and the on-chain examples in BitNameService.
export type Src101Operation = 'deploy' | 'mint' | 'transfer' | 'renew' | 'setrecord';

export interface Src101Deploy {
  p: 'src-101';
  op: 'deploy';
  name?: string;       // e.g. "BitNameService"
  root?: string;       // TLD root, e.g. "btc"
  lim?: string | number;
  pri?: unknown;
  desc?: string;
  // Other optional fields exist on real deploys but the structural minimum
  // here is `name` + `root`.
}

export interface Src101Mint {
  p: 'src-101';
  op: 'mint';
  // Deploy hash this mint registers against. Canonical: must reference an
  // existing deploy. We don't enforce existence here.
  hash?: string;
  // Token id list (UTF-8 byte arrays). Canonical: must be a non-empty list.
  tokenid?: unknown;
  tokenid_utf8?: unknown;
  // Coefficient int 0-1000, length-of-name pricing multiplier. Canonical
  // enforces but is a business rule; we only check the structural shape.
  coef?: unknown;
  dua?: unknown;
  img?: unknown;
  destination?: unknown;
}

export interface Src101Transfer {
  p: 'src-101';
  op: 'transfer';
  hash?: string;
  tokenid?: unknown;
  destination?: unknown;
  toaddress?: unknown;
}

export interface Src101Renew {
  p: 'src-101';
  op: 'renew';
  hash?: string;
  tokenid?: unknown;
  dua?: unknown;
}

export interface Src101SetRecord {
  p: 'src-101';
  op: 'setrecord';
  hash?: string;
  tokenid?: unknown;
  type?: unknown;
  data?: unknown;
}

export type Src101Parsed =
  | Src101Deploy
  | Src101Mint
  | Src101Transfer
  | Src101Renew
  | Src101SetRecord;

/**
 * Flaw types for invalid SRC-101 transactions. Cenotaph-style: parseable but
 * structurally invalid; the parent ordpool_src101 flag should NOT fire.
 */
export type Src101Flaw =
  | 'unknown_op'
  | 'missing_name'              // deploy without name
  | 'missing_root'              // deploy without root TLD
  | 'missing_tokenid'           // mint/transfer/renew/setrecord without tokenid array
  | 'missing_hash';             // mint/transfer/renew/setrecord without deploy hash

/**
 * Parses raw SRC-101 JSON content into a typed object. Returns null if the
 * content is not valid SRC-101 JSON structure (must be an object with
 * p:'src-101' and a known op).
 */
export function parseSrc101Content(content: string): Src101Parsed | null {
  if (typeof content !== 'string' || !content) {
    return null;
  }

  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    if (parsed?.p !== 'src-101') {
      return null;
    }

    if (
      parsed.op === 'deploy' ||
      parsed.op === 'mint' ||
      parsed.op === 'transfer' ||
      parsed.op === 'renew' ||
      parsed.op === 'setrecord'
    ) {
      return parsed as Src101Parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates a parsed SRC-101 object. Empty array = valid; non-empty = caller
 * should NOT set ordpool_src101.
 *
 * Mirrors the structural minimums in stampchain-io/btc_stamps
 * (src101.py:handle_*): deploy needs name + root; non-deploy ops need
 * tokenid (list) + hash (deploy reference). We do NOT replicate canonical's
 * isinstance(coef, int) / isinstance(img, list) gates because real deploys
 * sometimes use string-form ints, and our consumers don't read these fields.
 */
export function getSrc101Flaws(parsed: Src101Parsed): Src101Flaw[] {
  const flaws: Src101Flaw[] = [];

  if (parsed.op === 'deploy') {
    const deploy = parsed as Src101Deploy;
    if (typeof deploy.name !== 'string' || deploy.name.trim() === '') {
      flaws.push('missing_name');
    }
    if (typeof deploy.root !== 'string' || deploy.root.trim() === '') {
      flaws.push('missing_root');
    }
    return flaws;
  }

  // mint, transfer, renew, setrecord all reference an existing deploy and
  // a tokenid array.
  const op = parsed as Src101Mint | Src101Transfer | Src101Renew | Src101SetRecord;

  if (typeof op.hash !== 'string' || op.hash.trim() === '') {
    flaws.push('missing_hash');
  }
  if (!Array.isArray(op.tokenid) || op.tokenid.length === 0) {
    flaws.push('missing_tokenid');
  }

  return flaws;
}
