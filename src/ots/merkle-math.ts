import { OtsAttestation, OtsNode, OtsOp, ParsedOtsFile } from './parsed-ots';

/**
 * Structural facts about ONE leaf's path through a calendar's batch
 * Merkle tree AND the Bitcoin block-header Merkle tree that anchors
 * that calendar batch on-chain, derived purely from the operations
 * recorded in a parsed .ots receipt -- no Bitcoin lookup required.
 *
 * Computed once per Bitcoin attestation found in the parsed tree. A
 * receipt with attestations across multiple Bitcoin blocks yields one
 * entry per attestation.
 */
export interface MerkleMath {
  /** Bitcoin block this attestation anchors to. */
  blockheight: number;

  /** 0-based index of the receipt's TOP-LEVEL subtree this attestation
   *  descends from. A multi-calendar .ots has one root subtree per
   *  calendar (separated by the 0xff continuation byte at assembly
   *  time), so `subtreeIndex` plus the consumer's knowledge of which
   *  calendar was assembled at which index recovers the calendar
   *  identity even after upgrade -- the pending URI itself is gone
   *  from an upgraded subtree, so subtree position is the only handle
   *  the verifier still has on "whose anchor is this?". */
  subtreeIndex: number;

  /** Total number of top-level subtrees in the receipt. Same value for
   *  every MerkleMath in the same parse. */
  subtreeCount: number;

  /** The Merkle root the OTS path terminates at -- 32 bytes in OTS
   *  INTERNAL byte order (NOT the display byte order used by explorers).
   *  Equal to `node.msg` at the attestation node. Callers verifying
   *  against a block header must reverse() before comparing. */
  merkleRootInternal: Uint8Array;

  /** Every operation on the path from the file hash to this attestation,
   *  in application order (file-hash → ... → root). */
  pathOps: ReadonlyArray<PathOp>;

  /** Number of cryptographic-hash ops (sha256 / sha1 / ripemd160 /
   *  keccak256) on the path. Each one is one hashing round a verifier
   *  re-executes. */
  hashRoundCount: number;

  /** Sum of all bytes that OP_APPEND / OP_PREPEND injected into the
   *  running message. Equivalently, the receipt's "payload bytes
   *  excluding ops/markers/attestation headers" -- this is what the
   *  proof carries beyond the file hash itself. */
  proofPayloadBytes: number;

  /**
   * Calendar batch tree facts -- the part of the proof that says
   * "where in the calendar's batch was my submission?". One level per
   * `[append|prepend 32B sibling, sha256]` pair on the path, scanned
   * from the boundary with the Bitcoin tree backwards toward the file
   * hash. Null when no such pattern is detectable.
   */
  calendar: TreeMath | null;

  /**
   * Bitcoin block-header tree facts -- the levels connecting the
   * calendar's anchor transaction to the block's merkleroot, same for
   * every user that batched into the same calendar tx. One level per
   * `[append|prepend 32B sibling, sha256, sha256]` triplet at the END
   * of the path (Bitcoin uses double-SHA-256). `leafIndex` here is the
   * calendar's anchor tx position within the block. Null when no
   * Bitcoin triplets are present.
   */
  bitcoin: TreeMath | null;
}

export interface TreeMath {
  /** Number of tree levels detected. */
  depth: number;

  /** Leaf position in a balanced tree of this depth. Bits are read
   *  top-of-tree (MSB) → leaf-level (LSB):
   *    OP_APPEND  → "I'm the LEFT  child at this level" → bit 0
   *    OP_PREPEND → "I'm the RIGHT child at this level" → bit 1
   *  In an unbalanced tree (rightmost branch short-circuited because
   *  the leaf count isn't a power of two), treat as "best-effort
   *  position" -- still a deterministic identifier, just not always
   *  the canonical leaf number. */
  leafIndex: bigint;
}

export type PathOp =
  | { kind: 'sha1' }
  | { kind: 'ripemd160' }
  | { kind: 'sha256' }
  | { kind: 'keccak256' }
  | { kind: 'reverse' }
  | { kind: 'hexlify' }
  | { kind: 'append'; payloadBytes: number }
  | { kind: 'prepend'; payloadBytes: number };

/** Bounds on the leaf count of a balanced tree at a given depth:
 *  between 2^(depth-1)+1 and 2^depth (inclusive). Exact count isn't
 *  recoverable from one receipt because OTS / Bitcoin merkle
 *  accumulators can short-circuit unbalanced rightmost branches. */
export function estimatedBatchSize(depth: number): { min: bigint; max: bigint } {
  return {
    min: (1n << BigInt(depth - 1)) + 1n,
    max: 1n << BigInt(depth),
  };
}

/**
 * Walk the parsed OTS tree and, for every Bitcoin attestation found,
 * return the structural facts about the path that leads to it.
 *
 * Receipt with no Bitcoin attestation (e.g. pending-only): empty array.
 * Receipt with multiple Bitcoin anchors: one entry per anchor.
 */
export function computeMerkleMath(file: ParsedOtsFile): MerkleMath[] {
  const out: MerkleMath[] = [];
  const pathOps: PathOp[] = [];   // mutable stack; snapshotted at each attestation
  const subtreeCount = Math.max(1, file.root.children.length);

  // root.children.length is the number of top-level subtrees (one per
  // calendar in a multi-calendar receipt; 1 for single-chain). When we
  // descend into root.children[i] the subtreeIndex is fixed at i for
  // every attestation found inside.
  const visit = (node: OtsNode, subtreeIndex: number): void => {
    for (const att of node.attestations) {
      if (att.kind === 'bitcoin') {
        out.push(buildMath(att, node.msg, pathOps.slice(), subtreeIndex, subtreeCount));
      }
    }
    for (const c of node.children) {
      pathOps.push(opToPathOp(c.op));
      visit(c.node, subtreeIndex);
      pathOps.pop();
    }
  };

  // Special case: the root may itself carry an attestation (a degenerate
  // single-leaf receipt). Treat that as subtree 0 of 1.
  for (const att of file.root.attestations) {
    if (att.kind === 'bitcoin') {
      out.push(buildMath(att, file.root.msg, [], 0, subtreeCount));
    }
  }
  // Descend into each top-level subtree, carrying the subtree index.
  for (let i = 0; i < file.root.children.length; i++) {
    const c = file.root.children[i];
    pathOps.push(opToPathOp(c.op));
    visit(c.node, i);
    pathOps.pop();
  }
  return out;
}

function opToPathOp(op: OtsOp): PathOp {
  switch (op.kind) {
    case 'append':  return { kind: 'append',  payloadBytes: op.arg.length };
    case 'prepend': return { kind: 'prepend', payloadBytes: op.arg.length };
    default:        return { kind: op.kind };
  }
}

const HASH_OP_KINDS: ReadonlySet<PathOp['kind']> = new Set(['sha1', 'ripemd160', 'sha256', 'keccak256']);
function isHashOp(op: PathOp): boolean {
  return HASH_OP_KINDS.has(op.kind);
}

function buildMath(
  att: Extract<OtsAttestation, { kind: 'bitcoin' }>,
  attNodeMsg: Uint8Array,
  pathOps: PathOp[],
  subtreeIndex: number,
  subtreeCount: number,
): MerkleMath {
  let hashRoundCount = 0;
  let proofPayloadBytes = 0;
  for (const op of pathOps) {
    if (op.kind === 'append' || op.kind === 'prepend') proofPayloadBytes += op.payloadBytes;
    else if (isHashOp(op)) hashRoundCount++;
  }

  // Peel Bitcoin block-tree triplets (double-SHA-256) from the end
  // first; they sit furthest down the path because the receipt walks
  // file-hash → calendar root → tx body → tx hash → block merkleroot.
  const bitcoinPeel = peelTreeLevels(pathOps, pathOps.length, /* sha256RoundsPerLevel */ 2);
  // Between Bitcoin levels and the calendar tree there's the tx body
  // assembly (prepend tx prefix, append tx suffix, sha256, sha256 for
  // the txid). Skip backwards through that until we find the trailing
  // `[append|prepend 32, sha256]` of the calendar tree top.
  const calendarEnd = findCalendarTail(pathOps, bitcoinPeel.remaining);
  const calendarPeel = calendarEnd === -1
    ? null
    : peelTreeLevels(pathOps, calendarEnd, /* sha256RoundsPerLevel */ 1);

  return {
    blockheight: att.height,
    subtreeIndex,
    subtreeCount,
    merkleRootInternal: attNodeMsg,
    pathOps,
    hashRoundCount,
    proofPayloadBytes,
    calendar: calendarPeel && calendarPeel.depth > 0 ? { depth: calendarPeel.depth, leafIndex: calendarPeel.leafIndex } : null,
    bitcoin:  bitcoinPeel.depth  > 0 ? { depth: bitcoinPeel.depth,  leafIndex: bitcoinPeel.leafIndex  } : null,
  };
}

interface Peel {
  depth: number;
  leafIndex: bigint;
  /** Index in pathOps just BEFORE the peeled portion -- where the next
   *  peel (a different tree, say) should start scanning from. */
  remaining: number;
}

/**
 * Peel as many `[append|prepend 32-byte sibling] + N × sha256` blocks
 * as possible from the position `end` backwards in `pathOps`, where N
 * is the number of SHA-256 rounds per tree level (1 for calendar's
 * single-sha trees, 2 for Bitcoin's double-sha header tree).
 *
 * Returns the depth peeled, the leaf-index bits accumulated MSB-first
 * (so the resulting BigInt reads as the binary leaf index in a balanced
 * tree), and the index in `pathOps` still remaining BEFORE the peeled
 * portion.
 */
function peelTreeLevels(pathOps: ReadonlyArray<PathOp>, end: number, sha256RoundsPerLevel: number): Peel {
  const levelSize = 1 + sha256RoundsPerLevel;   // 1 sibling op + N sha256 ops
  let i = end;
  let depth = 0;
  let leafIndex = 0n;

  while (i >= levelSize) {
    let allSha = true;
    for (let k = 0; k < sha256RoundsPerLevel; k++) {
      if (pathOps[i - 1 - k].kind !== 'sha256') { allSha = false; break; }
    }
    if (!allSha) break;

    const sib = pathOps[i - levelSize];
    if (sib.kind !== 'append' && sib.kind !== 'prepend') break;
    if (sib.payloadBytes !== 32) break;

    // append → I'm LEFT (bit 0); prepend → I'm RIGHT (bit 1).
    // Insert at LSB end; previous bits shift up. Final order: first
    // peel (TOP of tree) → MSB; last peel (LEAF level) → LSB.
    const bit = sib.kind === 'prepend' ? 1n : 0n;
    leafIndex = (leafIndex << 1n) | bit;
    depth++;
    i -= levelSize;
  }

  return { depth, leafIndex, remaining: i };
}

/**
 * Walk backwards from `after` until the last two ops form a calendar
 * tree level shape `[append|prepend 32B, sha256]`. Returns the index
 * just AFTER that calendar top-level sha256 -- i.e. where peelTreeLevels
 * should start scanning calendar pairs from. Returns -1 if no such
 * pattern exists anywhere in `pathOps[0..after-1]`.
 */
function findCalendarTail(pathOps: ReadonlyArray<PathOp>, after: number): number {
  let i = after;
  while (i >= 2) {
    const last = pathOps[i - 1];
    const beforeLast = pathOps[i - 2];
    if (
      last.kind === 'sha256' &&
      (beforeLast.kind === 'append' || beforeLast.kind === 'prepend') &&
      beforeLast.payloadBytes === 32
    ) {
      return i;
    }
    i -= 1;
  }
  return -1;
}
