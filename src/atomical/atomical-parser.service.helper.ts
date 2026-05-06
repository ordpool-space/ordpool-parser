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
 * The atomicals-electrumx reference indexer is somewhat outdated and a few
 * doc comments inside it are incomplete or stale, but it remains the single
 * source of truth for which opcodes exist and what they mean. Everything
 * below is anchored to permalinks at commit 8df2374 -- click them to verify.
 *
 * ## Opcode dispatch (3-letter, 2-letter, 1-letter)
 *
 * Source: atomicals-electrumx `parse_operation_from_script`, lines 1119-1170:
 * https://github.com/atomicals/atomicals-electrumx/blob/8df23747835c20230fc8b8097d469e7a1d97c3e0/electrumx/lib/util_atomicals.py#L1119-L1170
 *
 * | Op    | Source comment                                            | Indexer-recorded label(s)                                       |
 * |-------|-----------------------------------------------------------|-----------------------------------------------------------------|
 * | nft   | "Mint non-fungible token"                                 | mint-nft / mint-nft-realm / -subrealm / -container / -dmitem    |
 * | ft    | "Mint fungible token with direct fixed supply"            | mint-ft (mint-ft-failed on validation failure)                  |
 * | dft   | "Deploy distributed mint fungible token starting point"   | dft (deploy phase) -- the anchor for subsequent dmt mints       |
 * | dmt   | "Mint tokens of distributed mint type (dft)"              | mint-dft -- claims a unit of an already-deployed dft            |
 * | dat   | "Store data on a transaction (dat)"                       | dat                                                             |
 * | mod   | "Modify general state"                                    | mod                                                             |
 * | evt   | "Message response/reply"                                  | evt                                                             |
 * | sl    | "Seal an NFT and lock it from further changes forever"    | seal                                                            |
 * | x     | "extract - move atomical to 0'th output"                  | splat                                                           |
 * | y     | "split -" (sic, incomplete in source)                     | split                                                           |
 * | z     | (no source comment)                                       | custom-color                                                    |
 *
 * Recorded labels are at block_processor.py:305-329 + 1906-2213:
 * https://github.com/atomicals/atomicals-electrumx/blob/8df23747835c20230fc8b8097d469e7a1d97c3e0/electrumx/server/block_processor.py#L305-L329
 *
 * Single-letter operation predicates (`is_splat_operation`,
 * `is_split_operation`, `is_custom_colored_operation`) at util_atomicals.py:
 * https://github.com/atomicals/atomicals-electrumx/blob/8df23747835c20230fc8b8097d469e7a1d97c3e0/electrumx/lib/util_atomicals.py#L1703-L1713
 *
 * ## Sub-types within `nft` (refined by CBOR args)
 *
 * The `nft` opcode covers five distinct mint subtypes; the indexer records
 * different labels based on which `args.*` key is present:
 * - plain NFT      -> mint-nft
 * - realm          -> args.request_realm        -> mint-nft-realm
 * - subrealm       -> args.request_subrealm     -> mint-nft-subrealm
 * - container      -> args.request_container    -> mint-nft-container
 * - container item -> args.request_dmitem       -> mint-nft-dmitem
 *
 * Realms are human-readable names registered on Bitcoin (like ENS on Ethereum).
 * Containers are named collections of NFTs. Container items are minted by
 * users against rules the container owner sets via `mod` operations on the
 * container itself ("dmint" -- distributed mint of NFTs).
 *
 * **Do not confuse `dmt` with `dmint`.** `dmt` is a fungible-token mint
 * opcode in its own right (mints a unit of a previously-deployed `dft`).
 * `dmint` is informal slang for the NFT-collection-mint flow, which is
 * always carried by the `nft` opcode plus `args.request_dmitem`.
 *
 * ## CBOR payload structure
 *
 * Every operation carries a CBOR-encoded map. Most ops include an `args`
 * sub-map. File attachments use either:
 * - Format 1: `{ "image.png": { $ct: "image/png", $b: <binary> } }` (old CLI path)
 * - Format 2: `{ "image.png": <raw binary bytes> }` (newer CLI path)
 *
 * Real-data coverage:
 * - dft, nft, x, y, z -- exact-value tests against mainnet txs
 * - ft, dmt, mod, evt, dat, sl -- recognition only, no fixture yet
 */
export type AtomicalOperation = 'dft' | 'nft' | 'ft' | 'dmt' | 'mod' | 'evt' | 'dat' | 'sl' | 'x' | 'y' | 'z' | 'unknown';

/**
 * Human-readable labels for every Atomicals operation. Use in UI legends
 * and chart axes; consumers can index this map by `parsed.operation` and
 * always get back a display string.
 *
 * The labels for the single-letter ops (`x`, `y`, `z`) match the strings
 * atomicals-electrumx records in `block_processor.py`:
 * https://github.com/atomicals/atomicals-electrumx/blob/8df23747835c20230fc8b8097d469e7a1d97c3e0/electrumx/server/block_processor.py#L2160-L2211
 *
 * The multi-letter labels are kept generic ("NFT", "FT", "distributed FT",
 * etc.) because the indexer further refines `nft` / `ft` / `dft` / `dmt`
 * based on CBOR args (see the `AtomicalOperation` doc comment for the
 * sub-type matrix). Consumers that want the refined label can inspect
 * args themselves; the parser only surfaces the raw opcode.
 */
export const ATOMICAL_OPERATION_LABELS: Record<AtomicalOperation, string> = {
  nft:     'NFT',
  ft:      'FT',
  dft:     'distributed FT',     // dft deploy; subsequent claims arrive as dmt
  dmt:     'distributed mint',   // mints a unit of a previously-deployed dft
  dat:     'data',
  mod:     'modify',
  evt:     'event',
  sl:      'seal',
  x:       'splat',              // util_atomicals.py: "extract - move atomical to 0'th output"
  y:       'split',              // FT-amount distribution across outputs per a CBOR map
  z:       'custom-color',       // is_custom_colored_operation predicate; no source-comment semantic
  unknown: 'unknown',
};

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
