import { concatUint8Arrays, hexToBytes, isStringInArrayOfStrings } from '../lib/conversions';
import { OP_ENDIF } from '../lib/op-codes';
import { readPushdata } from '../lib/reader';

// OP_FALSE (0x00), OP_IF (0x63), OP_PUSHBYTES_4 (0x04), 'a', 't', 'o', 'm' (0x61, 0x74, 0x6f, 0x6d)
const ATOMICAL_MARK = new Uint8Array([0x00, 0x63, 0x04, 0x61, 0x74, 0x6f, 0x6d]);
const ATOMICAL_MARK_HEX = '00630461746f6d';

/**
 * Checks if an atomical mark is found within a witness array.
 *
 * This code can potentially return false positive matches!
 *
 * @param witness - Array of hex-encoded witness elements.
 * @returns True if an atomical mark is found, false otherwise.
 */
export function hasAtomical(witness: string[]): boolean {
  return isStringInArrayOfStrings(ATOMICAL_MARK_HEX, witness);
}

/**
 * Atomicals protocol operation types.
 *
 * The Atomicals protocol (https://github.com/atomicals/atomicals-js) launched Sep 2023
 * on Bitcoin mainnet. It uses a commit-reveal scheme similar to Ordinals inscriptions,
 * but with CBOR-encoded payloads instead of raw content. The envelope marker is "atom"
 * (4 bytes) vs inscriptions' "ord" (3 bytes).
 *
 * ## Terminology cheat sheet (the Atomicals ecosystem has MANY overlapping terms)
 *
 * **ARC-20** — The fungible token standard on Atomicals (like BRC-20 is to Ordinals).
 *   All ARC-20 tokens are created via `dft` (distributed) or `ft` (direct) operations.
 *   The atomicalmarket.com explorer labels both as "FT".
 *
 * **Realm** — A human-readable name registered on Bitcoin (like ENS on Ethereum).
 *   Created via `nft` operation with `args.request_realm`. Realms are NFTs internally.
 *   Subrealms (e.g., "sub.realm") are also `nft` operations.
 *
 * **Container** — A named collection of NFTs (like an NFT project/PFP collection).
 *   The container itself is created via `nft` with `args.request_container`.
 *   Individual items are minted via `nft` with `args.request_dmitem` + `args.parent_container`.
 *
 * **dmint** — "Distributed mint" for container items. NOT a separate operation type.
 *   Uses `nft` operation, identified by `args.request_dmitem` in the CBOR payload.
 *   The container owner sets mint rules via `mod` operations.
 *
 * **dmt** — A newer operation type for distributed minting of NFT collections.
 *   Found in atomicals-js source but rare on mainnet.
 *
 * ## Operation categories
 *
 * **Create new atomicals** (appear in explorer):
 * - `nft`  — Mint an NFT, realm, subrealm, or container item
 * - `ft`   — Create a direct fungible token (entire supply to creator)
 * - `dft`  — Deploy a distributed fungible token (anyone can mint)
 * - `dmt`  — Distributed mint for NFT collections
 * - `dat`  — Store standalone data on-chain
 *
 * **Modify existing atomicals** (do NOT appear in explorer as new entries):
 * - `mod`  — Update/set/delete data on an existing atomical
 * - `evt`  — Emit an event log attached to an existing atomical
 * - `sl`   — Seal a container (make it immutable)
 *
 * **Transfer/manage fungible token UTXOs** (single-letter codes, very niche):
 * - `x`   — "splat": split a UTXO containing multiple FT units into separate outputs
 * - `y`   — "split": similar split operation for FT UTXOs
 * - `z`   — "custom-color": set custom coloring/labeling on fungible token outputs
 *
 * Source: `splat-interactive-command.ts`, `split-interactive-command.ts`,
 * `custom-color-interactive-command.ts` in atomicals-js.
 *
 * ## CBOR payload structure
 *
 * Every operation carries a CBOR-encoded map. The `args` key is always present.
 * File attachments use either:
 * - Format 1: `{ "image.png": { $ct: "image/png", $b: <binary> } }` (old CLI path)
 * - Format 2: `{ "image.png": <raw binary bytes> }` (newer CLI path)
 *
 * Verified with real mainnet data: 'dft' (tx 1d2f39f5...), 'nft' (tx d8c96e39..., 7c852754...)
 * Known from atomicals-js source but no test data yet: 'ft', 'dmt', 'mod', 'evt', 'dat', 'sl', 'x', 'y', 'z'
 */
export type AtomicalOperation = 'dft' | 'nft' | 'ft' | 'dmt' | 'mod' | 'evt' | 'dat' | 'sl' | 'x' | 'y' | 'z' | 'unknown';

/**
 * Finds the atomical mark in raw witness bytes and extracts the operation type.
 *
 * After the 7-byte mark, the next pushdata contains the operation identifier.
 * Common operations use single-byte ASCII: 'm' (0x6d), 'u' (0x75), 'x' (0x78), etc.
 * Some use multi-byte strings like 'nft', 'ft', 'dft', 'mod', 'evt', 'dat', 'sl'.
 *
 * @param raw - The raw witness bytes.
 * @returns The operation string, or null if no atomical mark found.
 */
export function extractAtomicalOperation(raw: Uint8Array): AtomicalOperation | null {
  const afterMark = getNextAtomicalMark(raw, 0);
  if (afterMark === -1) {
    return null;
  }
  try {
    const [slice] = readPushdata(raw, afterMark);
    return mapOperationString(String.fromCharCode(...slice));
  } catch {
    return 'unknown';
  }
}

/**
 * Extracts the atomical operation from a witness array.
 *
 * @param witness - Array of hex-encoded witness elements.
 * @returns The operation, or null if no atomical found.
 */
export function extractAtomicalOperationFromWitness(witness: string[]): AtomicalOperation | null {
  for (const element of witness) {
    if (element.includes(ATOMICAL_MARK_HEX)) {
      const raw = hexToBytes(element);
      const op = extractAtomicalOperation(raw);
      if (op !== null) {
        return op;
      }
    }
  }
  return null;
}

/**
 * The full extracted atomical envelope: operation + raw CBOR payload.
 */
export interface AtomicalEnvelope {
  operation: AtomicalOperation;
  payload: Uint8Array;
}

/**
 * Searches for the atomical mark in raw bytes and returns the position
 * immediately after the mark (i.e., where the operation pushdata starts).
 * Returns -1 if no mark is found.
 *
 * Modeled after getNextInscriptionMark() in the inscription parser.
 */
export function getNextAtomicalMark(raw: Uint8Array, startPosition: number): number {
  for (let i = startPosition; i <= raw.length - ATOMICAL_MARK.length; i++) {
    let match = true;
    for (let j = 0; j < ATOMICAL_MARK.length; j++) {
      if (raw[i + j] !== ATOMICAL_MARK[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i + ATOMICAL_MARK.length;
    }
  }
  return -1;
}

/**
 * Extracts the full atomical envelope from raw witness bytes:
 * operation string + concatenated CBOR payload chunks.
 *
 * Uses readPushdata() to correctly handle multi-chunk payloads (>520 bytes),
 * same approach as the inscription parser's body extraction.
 *
 * Envelope layout after the 7-byte mark:
 *   <pushdata: operation string>    e.g., 03 "dft"
 *   <pushdata: CBOR chunk 1>       up to 520 bytes each
 *   <pushdata: CBOR chunk 2>
 *   ...
 *   OP_ENDIF (0x68)
 */
export function extractAtomicalEnvelope(raw: Uint8Array): AtomicalEnvelope | null {
  const afterMark = getNextAtomicalMark(raw, 0);
  if (afterMark === -1) {
    return null;
  }

  let pointer = afterMark;

  // Read the operation string
  let slice: Uint8Array;
  [slice, pointer] = readPushdata(raw, pointer);
  const opString = String.fromCharCode(...slice);
  const operation = mapOperationString(opString);

  // Collect CBOR payload chunks until OP_ENDIF (same pattern as inscription body)
  const chunks: Uint8Array[] = [];
  while (pointer < raw.length && raw[pointer] !== OP_ENDIF) {
    [slice, pointer] = readPushdata(raw, pointer);
    chunks.push(slice);
  }

  const payload = concatUint8Arrays(chunks);

  return { operation, payload };
}

/**
 * Extracts the full atomical envelope from a witness array.
 */
export function extractAtomicalEnvelopeFromWitness(witness: string[]): AtomicalEnvelope | null {
  for (const element of witness) {
    if (element.includes(ATOMICAL_MARK_HEX)) {
      const raw = hexToBytes(element);
      const envelope = extractAtomicalEnvelope(raw);
      if (envelope !== null) {
        return envelope;
      }
    }
  }
  return null;
}

/**
 * Maps an operation string to the AtomicalOperation type.
 */
function mapOperationString(opString: string): AtomicalOperation {
  switch (opString) {
    case 'nft': return 'nft';
    case 'ft': return 'ft';
    case 'dft': return 'dft';
    case 'dmt': return 'dmt';
    case 'mod': return 'mod';
    case 'evt': return 'evt';
    case 'dat': return 'dat';
    case 'sl': return 'sl';
    case 'x': return 'x';   // splat: split FT UTXO into separate outputs
    case 'y': return 'y';   // split: similar FT UTXO split
    case 'z': return 'z';   // custom-color: set custom coloring on FT outputs
    default: return 'unknown';
  }
}
