/**
 * Public types for the .ots file parser/verifier.
 *
 * An OpenTimestamps `.ots` proof is a binary tree: the root is the SHA256
 * (or other hash op) of the user's file; every internal node is an
 * operation applied to its parent's message; every leaf is an attestation
 * (the bare-minimum data needed to look the commitment up against an
 * external block-header source).
 */

/** Hash algorithm used to compute the file digest at the root of the tree. */
export type FileHashAlgo = 'sha1' | 'ripemd160' | 'sha256' | 'keccak256';

/** Internal tree node: one operation that transforms the parent's message. */
export type OtsOp =
  | { kind: 'sha1' }
  | { kind: 'ripemd160' }
  | { kind: 'sha256' }
  | { kind: 'keccak256' }
  | { kind: 'reverse' }
  | { kind: 'hexlify' }
  | { kind: 'append'; arg: Uint8Array }
  | { kind: 'prepend'; arg: Uint8Array };

/** Leaf node: one attestation. */
export type OtsAttestation =
  | { kind: 'pending'; uri: string }
  | { kind: 'bitcoin'; height: number }
  | { kind: 'litecoin'; height: number }
  | { kind: 'ethereum'; height: number }
  // Tag the verifier didn't recognise. Payload preserved as-is so consumers
  // can render "unknown attestation tag XX..." without losing info.
  | { kind: 'unknown'; tag: string; payload: Uint8Array };

/**
 * One node in the timestamp tree as parsed from the .ots file. Each node has
 * its `msg` (32 bytes for the typical file-hash root, or whatever the parent
 * op produced), zero or more attestations at this node, and zero or more
 * children that descend into further ops.
 *
 * A consumer that wants to verify "this .ots proves my file existed at or
 * before block N" walks the tree to find every BitcoinBlockHeaderAttestation;
 * the attestation's `height` says which block to look up, and `node.msg`
 * is the merkleroot the block's header MUST match.
 */
export interface OtsNode {
  msg: Uint8Array;                           // 32 bytes for SHA256 chains, 20 for SHA1/RIPEMD160
  attestations: OtsAttestation[];
  children: Array<{ op: OtsOp; node: OtsNode }>;
}

/** The whole .ots file. */
export interface ParsedOtsFile {
  fileHashAlgo: FileHashAlgo;
  fileHash: Uint8Array;          // the digest of the user's file (root.msg)
  root: OtsNode;
}

/**
 * Convenience flat view: every BitcoinBlockHeaderAttestation found in the
 * tree, with the message at its node (= the expected block merkleroot) and
 * the block height the attestation references.
 */
export interface OtsBitcoinAttestation {
  blockheight: number;
  expectedMerkleRoot: Uint8Array;     // 32 bytes; compare against block.merkle_root
}
