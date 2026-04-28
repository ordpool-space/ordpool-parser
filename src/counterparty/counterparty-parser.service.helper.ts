import { Arc4 } from '../lib/arc4';
import { CBOR } from '../lib/cbor';
import { bigEndianBytesToNumber, concatUint8Arrays, hexToBytes } from '../lib/conversions';
import { readPushdata } from '../lib/reader';
import { extractPubkeysRaw, parseScript } from '../lib/script';
import { CounterpartyEncoding, CounterpartyMessageType } from '../types/parsed-counterparty';

// "CNTRPRTY" in ASCII (hex: 434e545250525459)
const CNTRPRTY_PREFIX = new Uint8Array([0x43, 0x4e, 0x54, 0x52, 0x50, 0x52, 0x54, 0x59]);

// Mainnet UNSPENDABLE address: 1CounterpartyXXXXXXXXXXXXXXXUWLpVr
// scriptpubkey is P2PKH: 76a914 + hash160(818895f3dc2c178629d3d2d8fa3ec4a3f8179821) + 88ac
// The address is hardcoded in counterparty-core/lib/config.py as UNSPENDABLE_MAINNET.
// Any tx output paying this scriptpubkey is a burn (proof-of-burn protocol, Jan-Feb 2014).
export const UNSPENDABLE_MAINNET_SCRIPTPUBKEY =
  '76a914818895f3dc2c178629d3d2d8fa3ec4a3f817982188ac';

/**
 * Extracted Counterparty message payload from a Bitcoin transaction.
 */
export interface CounterpartyPayload {
  encoding: CounterpartyEncoding;
  messageTypeId: number;
  messageType: CounterpartyMessageType;
  messageData: Uint8Array;
}

/**
 * Extracts raw data from an OP_RETURN scriptpubkey.
 *
 * OP_RETURN format: 0x6a (OP_RETURN opcode) followed by pushdata.
 * Example: 6a2a<42 bytes of data> = OP_RETURN PUSH42 <data>
 */
export function extractOpReturnData(scriptpubkey: string): Uint8Array | null {
  // Must start with 6a (OP_RETURN)
  if (!scriptpubkey.startsWith('6a')) {
    return null;
  }

  // Counterparty OP_RETURN is a single pushdata (byte after 6a must be 0x01-0x4e).
  // Runes use OP_PUSHNUM_13 (0x5d) which is NOT a pushdata opcode -- skip instantly.
  // This avoids hexToBytes + readPushdata + ARC4 for every Rune transaction.
  const secondByteHex = parseInt(scriptpubkey.substring(2, 4), 16);
  if (secondByteHex > 0x4e) {
    return null;
  }

  // Minimum valid Counterparty OP_RETURN: 6a + push_prefix + 9 bytes (CNTRPRTY + type_id)
  // = at least 22 hex chars (11 bytes). Skip anything shorter.
  if (scriptpubkey.length < 22) {
    return null;
  }

  const bytes = hexToBytes(scriptpubkey);

  // Counterparty requires EXACTLY [OP_RETURN, PushBytes(data)] -- two instructions, no more.
  // Parity with: bitcoin_client.rs parse_vout(), pattern [Ok(Op(OP_RETURN)), Ok(PushBytes(pb))]
  // We read the single pushdata, then verify no trailing data exists.
  try {
    const [data, nextPointer] = readPushdata(bytes, 1);
    if (nextPointer !== bytes.length) {
      return null; // trailing data after pushdata -- not a valid Counterparty OP_RETURN
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Checks if decrypted bytes start with the CNTRPRTY prefix.
 */
function hasCntrprtyPrefix(decrypted: Uint8Array): boolean {
  if (decrypted.length < 8) {
    return false;
  }
  for (let i = 0; i < 8; i++) {
    if (decrypted[i] !== CNTRPRTY_PREFIX[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Type guard for parsed script elements: true if the element is pushdata (Uint8Array), not an opcode.
 */
function isData(el: number | Uint8Array): el is Uint8Array {
  return typeof el !== 'number';
}

/**
 * Parses message type ID and payload from a Counterparty data buffer.
 *
 * Message type ID: 1 byte if 0 < ID < 256, otherwise 4 bytes big-endian.
 * Special case: ID 0 (classic send) uses 4-byte big-endian encoding.
 *
 * Source: counterpartycore/lib/parser/messagetype.py (unpack)
 */
function parseMessageTypeId(data: Uint8Array): { messageTypeId: number, messageData: Uint8Array } | null {
  if (data.length < 1) {
    return null;
  }

  // ID 0 (classic send) uses 4-byte big-endian encoding.
  // All other IDs (1-255) use 1-byte encoding.
  if (data[0] === 0) {
    if (data.length < 5) {
      return null; // truncated -- Counterparty rejects this too
    }
    return {
      messageTypeId: bigEndianBytesToNumber(data.subarray(0, 4)),
      messageData: data.subarray(4),
    };
  }

  return { messageTypeId: data[0], messageData: data.subarray(1) };
}

/**
 * Maps a Counterparty message type ID to its human-readable name.
 *
 * Source: counterparty-core/counterpartycore/lib/messages/__init__.py
 * https://github.com/CounterpartyXCP/counterparty-core
 */
export function mapMessageType(id: number): CounterpartyMessageType {
  switch (id) {
    case 0: return 'send';                 // send1.py — classic send (4-byte ID encoding)
    case 2: return 'enhanced_send';        // versions/enhancedsend.py
    case 3: return 'mpma';                 // versions/mpma.py — Multi-Peer Multi-Asset
    case 4: return 'sweep';                // sweep.py
    case 10: return 'order';               // order.py
    case 11: return 'btcpay';              // btcpay.py
    case 12: return 'dispenser';           // dispenser.py
    case 13: return 'dispense';            // dispenser.py — DISPENSE_ID (auto-triggered)
    case 20: return 'issuance';            // issuance.py — standard issuance
    case 21: return 'issuance_subasset';   // issuance.py — SUBASSET_ID
    case 22: return 'issuance';            // issuance.py — LR_ISSUANCE_ID (lock/reset)
    case 23: return 'issuance_subasset';   // issuance.py — LR_SUBASSET_ID (lock/reset)
    case 30: return 'broadcast';           // broadcast.py
    case 40: return 'bet';                 // bet.py
    case 50: return 'dividend';            // dividend.py
    case 60: return 'burn';                // burn.py — XCP creation via proof-of-burn (Jan-Feb
                                           // 2014). NOT generic asset destruction (that's 110).
                                           // Set by tryDetectBurn(), not ARC4 -- burns have no
                                           // CNTRPRTY message data; identified by an output to
                                           // 1CounterpartyXXXXXXXXXXXXXXXUWLpVr (UNSPENDABLE).
    case 70: return 'cancel';              // cancel.py
    case 80: return 'rps';                 // rps.py
    case 81: return 'rps_resolve';         // rpsresolve.py
    case 90: return 'fairminter';          // fairminter.py
    case 91: return 'fairmint';            // fairmint.py
    case 100: return 'utxo';              // utxo.py — DEFENSIVE: defined in counterparty-core
                                           // (struct.pack format with ID=100) but no mainnet tx
                                           // composes this form -- verified by scanning 100,000
                                           // recent transactions, zero with 0x64 / 00000064
                                           // prefix. Production UTXO moves are tracked statefully
                                           // (the indexer maintains a UTXO->asset ledger and
                                           // observes spends) -- this requires state beyond a
                                           // single-tx parser. The two on-chain message-encoded
                                           // forms are 101 (attach) and 102 (detach).
    case 101: return 'attach';             // attach.py
    case 102: return 'detach';             // detach.py
    case 110: return 'destroy';            // destroy.py
    default: return 'unknown';
  }
}

/**
 * Tries to decrypt and validate Counterparty data from OP_RETURN outputs.
 * This is the fastest detection method (decrypt ≤80 bytes, check prefix).
 */
/**
 * Detects a Counterparty proof-of-burn transaction.
 *
 * NOTE: This is XCP CREATION, not generic asset destruction. The mechanism
 * that bootstrapped XCP supply: between blocks 278,310 and 283,810 (Jan 2 -
 * Feb 5, 2014, ~5,500 blocks), users sent BTC to a hardcoded unspendable
 * address and the protocol minted XCP for them at a time-decaying rate
 * (multiplier 1500 -> 1000). Total ~2,124 BTC burned, ~2.6M XCP created.
 * Generic token destruction is a different message type (110, 'destroy').
 *
 * Detection is by destination: any tx output paying UNSPENDABLE_MAINNET
 * (1CounterpartyXXXXXXXXXXXXXXXUWLpVr) is a Counterparty burn event. The
 * address is unspendable by construction -- its bytes encode the literal
 * string "Counterparty" so no private key exists. Anyone paying it is
 * doing this intentionally.
 *
 * The parser is stateless and does not filter by block height. Sends to
 * UNSPENDABLE after block 283,810 are still recognized as type 60 burns
 * (matching counterparty-core, where burn.py validate() returns
 * problems=["too late"] for post-window blocks -- the message type is
 * recognized but marked invalid). Callers that need window validation
 * can apply it themselves.
 *
 * Maps to message_type_id 60 (burn.py ID = 60). The message data is empty:
 * burn.py compose() returns (source, [(destination, quantity)], None) -- the
 * third tuple element is the on-chain message, which is None.
 */
export function tryDetectBurn(
  vout: { scriptpubkey: string }[]
): CounterpartyPayload | null {
  for (const output of vout) {
    if (output.scriptpubkey === UNSPENDABLE_MAINNET_SCRIPTPUBKEY) {
      return {
        encoding: 'destination',
        messageTypeId: 60,
        messageType: 'burn',
        messageData: new Uint8Array(0),
      };
    }
  }
  return null;
}

export function tryDecryptOpReturn(
  vout: { scriptpubkey: string, scriptpubkey_type: string }[],
  arc4Key: Uint8Array
): CounterpartyPayload | null {

  for (const output of vout) {
    if (output.scriptpubkey_type !== 'op_return') {
      continue;
    }

    const data = extractOpReturnData(output.scriptpubkey);
    if (!data || data.length < 9) {
      continue;
    }

    // ARC4 decrypt
    const arc4 = new Arc4(arc4Key);
    const decrypted = arc4.processBytes(data);

    // Check for CNTRPRTY prefix (first 8 bytes)
    if (!hasCntrprtyPrefix(decrypted)) {
      continue;
    }

    // Strip the 8-byte CNTRPRTY prefix, then parse message type ID
    const parsed = parseMessageTypeId(decrypted.subarray(CNTRPRTY_PREFIX.length));
    if (!parsed) {
      continue;
    }

    return {
      encoding: 'opreturn',
      messageTypeId: parsed.messageTypeId,
      messageType: mapMessageType(parsed.messageTypeId),
      messageData: parsed.messageData,
    };
  }

  return null;
}

/**
 * Tries to decrypt and validate Counterparty data from bare multisig outputs.
 *
 * Each multisig output is independently decrypted with a FRESH ARC4 instance.
 * Each output contains its own length byte (byte[0]) and CNTRPRTY prefix (bytes[1..9]).
 * Data from all outputs is concatenated after stripping per-output overhead.
 *
 * Source: counterparty-rs/src/indexer/bitcoin_client.rs (parse_vout, multisig branch)
 * Source: counterpartycore/lib/parser/gettxinfo.py (decode_checkmultisig)
 *
 * WARNING: This is expensive — requires decrypting every multisig output.
 * Only call this if OP_RETURN and P2TR detection both failed.
 */
export function tryDecryptMultisig(
  vout: { scriptpubkey: string, scriptpubkey_type: string }[],
  arc4Key: Uint8Array
): CounterpartyPayload | null {

  const messageChunks: Uint8Array[] = [];

  for (const output of vout) {
    if (output.scriptpubkey_type !== 'multisig' && output.scriptpubkey_type !== 'unknown') {
      continue;
    }

    // Extract pubkeys as raw bytes from the multisig script
    const pubkeys = extractPubkeysRaw(output.scriptpubkey);
    if (pubkeys.length < 2) {
      continue;
    }

    // Collect data from all pubkeys EXCEPT the last (sender's real pubkey)
    // Strip first byte (curve prefix) and last byte (nonce/padding) from each.
    // Parity with: bitcoin_client.rs line 311: chunk[1..chunk.len()-1]
    // We accept any pubkey size (not just 33 bytes) to match the Rust code exactly.
    const dataChunks: Uint8Array[] = [];
    for (let i = 0; i < pubkeys.length - 1; i++) {
      const pubkey = pubkeys[i];
      if (pubkey.length < 2) {
        continue; // too short to strip first+last byte (matches Rust's chunk.len() < 2 guard)
      }
      dataChunks.push(pubkey.subarray(1, pubkey.length - 1));
    }

    if (dataChunks.length === 0) {
      continue;
    }

    const outputData = concatUint8Arrays(dataChunks);

    // ARC4 decrypt with a FRESH cipher instance per output
    // (each output is independently encrypted — same key, fresh state)
    const arc4 = new Arc4(arc4Key);
    const decrypted = arc4.processBytes(outputData);

    // Check: byte[0] = length, bytes[1..9] must be CNTRPRTY prefix
    if (decrypted.length < 9) {
      continue;
    }

    // bytes[1..=prefix.length] must match CNTRPRTY
    if (!hasCntrprtyPrefix(decrypted.subarray(1))) {
      // Not a data output — skip (it's a destination)
      continue;
    }

    // Use the length byte to truncate (avoids trailing padding)
    const chunkLen = Math.min(decrypted[0], decrypted.length - 1);
    const chunk = decrypted.subarray(1, 1 + chunkLen);

    // Strip the 8-byte CNTRPRTY prefix from the chunk
    messageChunks.push(chunk.subarray(CNTRPRTY_PREFIX.length));
  }

  if (messageChunks.length === 0) {
    return null;
  }

  const allData = concatUint8Arrays(messageChunks);
  const parsed = parseMessageTypeId(allData);
  if (!parsed) {
    return null;
  }

  return {
    encoding: 'multisig',
    messageTypeId: parsed.messageTypeId,
    messageType: mapMessageType(parsed.messageTypeId),
    messageData: parsed.messageData,
  };
}

// Literal "CNTRPRTY" OP_RETURN scriptpubkey: OP_RETURN (0x6a) PUSH8 (0x08) "CNTRPRTY" (434e545250525459)
const CNTRPRTY_OP_RETURN_HEX = '6a08434e545250525459';

/**
 * Checks if a parsed script element is pushdata matching the given ASCII string.
 */
function isPushString(el: number | Uint8Array, expected: string): boolean {
  if (!isData(el) || el.length !== expected.length) return false;
  for (let i = 0; i < el.length; i++) {
    if (el[i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Checks if a parsed script element is a single-byte push with the given value.
 */
function isSingleBytePush(el: number | Uint8Array, value: number): boolean {
  return isData(el) && el.length === 1 && el[0] === value;
}

/**
 * Extracts Counterparty data from a P2TR (Taproot) reveal transaction.
 *
 * Counterparty v11+ (block 902,000) uses a commit-reveal pattern:
 * - Commit: sends to a P2TR address containing an envelope script
 * - Reveal: spends the commit UTXO with:
 *   1. OP_RETURN output with literal "CNTRPRTY" (NOT encrypted)
 *   2. Witness with 3 elements: [schnorr_sig, envelope_script, control_block]
 *
 * Two envelope formats exist:
 *
 * 1. Generic envelope (most common on mainnet):
 *    OP_FALSE OP_IF <data chunks> OP_ENDIF <pubkey> OP_CHECKSIG
 *    Data = message_type_id + CBOR payload (same as OP_RETURN/multisig after decryption)
 *
 * 2. "ord" inscription envelope (for issuance/fairminter/broadcast with content):
 *    OP_FALSE OP_IF "ord" [7] "xcp" [1] <mime_type> [5] <metadata>... [0] <content>... OP_ENDIF <pubkey> OP_CHECKSIG
 *    Metadata is CBOR array: [message_type_id, ...fields]
 *    The Counterparty node extracts type_id, appends mime_type + description, re-encodes.
 *
 * Source: counterparty-rs/src/indexer/bitcoin_client.rs (extract_data_from_witness)
 */
export function tryExtractP2tr(
  vin: { txid: string, witness?: string[] }[],
  vout: { scriptpubkey: string, scriptpubkey_type: string }[]
): CounterpartyPayload | null {

  // Step 1: Check for literal "CNTRPRTY" OP_RETURN output
  const hasCntrprtyOpReturn = vout.some(v =>
    v.scriptpubkey_type === 'op_return' && v.scriptpubkey === CNTRPRTY_OP_RETURN_HEX
  );
  if (!hasCntrprtyOpReturn) {
    return null;
  }

  // Step 2: Check first input's witness for exactly 3 elements (P2TR script path spend)
  // Counterparty only checks vin[0] — vtxinwit[0].len() == 3
  if (!vin.length || !vin[0].witness || vin[0].witness.length !== 3) {
    return null;
  }

  // witness[1] is the envelope script
  const scriptHex = vin[0].witness[1];
  const scriptBytes = hexToBytes(scriptHex);

  // Parse the script into elements (opcodes + pushdata)
  const elements = parseScript(scriptBytes);

  // Validate envelope structure: must start with OP_FALSE(0x00) OP_IF(0x63)
  // and end with OP_ENDIF(0x68) <pubkey> OP_CHECKSIG(0xac)
  if (elements.length < 5 ||
      elements[0] !== 0x00 || elements[1] !== 0x63 ||
      elements[elements.length - 1] !== 0xac) {
    return null;
  }

  // Check if this is an "ord" inscription envelope:
  // elements[2] == "ord" and elements[3] == [7] (tag 7 = metaprotocol)
  const isOrd = elements.length >= 7 &&
    isPushString(elements[2], 'ord') &&
    isSingleBytePush(elements[3], 7);

  if (isOrd) {
    return extractOrdEnvelopeData(elements);
  } else {
    return extractGenericEnvelopeData(elements);
  }
}

/**
 * Extracts data from a generic P2TR envelope (most common on mainnet).
 * Collects all pushdata between OP_IF and OP_ENDIF.
 *
 * Source: extract_data_from_witness() generic branch in bitcoin_client.rs
 */
function extractGenericEnvelopeData(elements: Array<number | Uint8Array>): CounterpartyPayload | null {
  // Collect all pushdata between elements[2] and the OP_ENDIF
  // (skip first 2: OP_FALSE + OP_IF, skip last 3: OP_ENDIF + pubkey + OP_CHECKSIG)
  const dataChunks: Uint8Array[] = [];
  for (let i = 2; i < elements.length - 3; i++) {
    const el = elements[i];
    if (isData(el)) {
      dataChunks.push(el);
    }
  }

  if (dataChunks.length === 0) {
    return null;
  }

  const data = concatUint8Arrays(dataChunks);
  const parsed = parseMessageTypeId(data);
  if (!parsed) {
    return null;
  }

  return {
    encoding: 'p2tr',
    messageTypeId: parsed.messageTypeId,
    messageType: mapMessageType(parsed.messageTypeId),
    messageData: parsed.messageData,
  };
}

/**
 * Extracts data from an "ord" inscription P2TR envelope.
 * Format: OP_FALSE OP_IF "ord" [7] "xcp" [1] <mime> [5] <meta>... [0] <content>... OP_ENDIF <pk> OP_CHECKSIG
 *
 * The Counterparty node:
 * 1. CBOR-decodes metadata as an array: [message_type_id, ...fields]
 * 2. Extracts message_type_id (first element)
 * 3. Appends mime_type and description to remaining fields
 * 4. Re-encodes as CBOR, prefixed with the type_id byte
 *
 * We replicate this exact behavior so our output matches the Counterparty node.
 *
 * Source: extract_data_from_witness() ord branch in bitcoin_client.rs
 */
function extractOrdEnvelopeData(elements: Array<number | Uint8Array>): CounterpartyPayload | null {
  // elements layout: [OP_FALSE, OP_IF, "ord", [7], "xcp", [1], <mime>, ...tags..., OP_ENDIF, <pk>, OP_CHECKSIG]

  // Extract mime_type from elements[6]
  let mimeType = '';
  if (elements.length > 6 && isData(elements[6])) {
    try {
      mimeType = new TextDecoder().decode(elements[6]);
    } catch {
      // ignore decode errors
    }
  }

  // Starting from elements[7], process tag markers:
  // - Tag 5 (single byte 0x05): next chunk is metadata
  // - Tag 0 / OP_0 / empty push: switch to description section
  const metadataChunks: Uint8Array[] = [];
  const descriptionChunks: Uint8Array[] = [];
  let currentSection: 'none' | 'metadata' | 'description' = 'none';

  // Stop before last 3 elements (OP_ENDIF + pubkey + OP_CHECKSIG)
  for (let i = 7; i < elements.length - 3; i++) {
    const el = elements[i];

    // Check for section markers
    if (isData(el)) {
      if (el.length === 1 && el[0] === 5) {
        currentSection = 'metadata';
        continue;
      }
      if ((el.length === 1 && el[0] === 0) || el.length === 0) {
        currentSection = 'description';
        continue;
      }
    } else if (el === 0x00) {
      // OP_0 / OP_FALSE -- description separator
      currentSection = 'description';
      continue;
    }

    // Collect pushdata in the current section
    if (currentSection !== 'none' && isData(el)) {
      if (currentSection === 'metadata') {
        metadataChunks.push(el);
      } else {
        descriptionChunks.push(el);
      }
    }
  }

  if (metadataChunks.length === 0) {
    return null;
  }

  // Combine metadata chunks and CBOR-decode
  const combinedMetadata = concatUint8Arrays(metadataChunks);
  let decoded: unknown;
  try {
    decoded = CBOR.decode(combinedMetadata);
  } catch {
    return null;
  }

  // Must be a CBOR array with message_type_id as first element
  if (!Array.isArray(decoded) || decoded.length === 0) {
    return null;
  }

  const messageTypeId = decoded[0];
  if (typeof messageTypeId !== 'number') {
    return null;
  }

  // Reconstruct the data the same way Counterparty does:
  // Remove type_id from array, append mime_type + description, re-encode as CBOR
  const remaining = decoded.slice(1);
  remaining.push(mimeType);

  if (descriptionChunks.length > 0) {
    remaining.push(concatUint8Arrays(descriptionChunks));
  }

  let reEncoded: Uint8Array;
  try {
    reEncoded = new Uint8Array(CBOR.encode(remaining));
  } catch {
    return null;
  }

  return {
    encoding: 'p2tr',
    messageTypeId,
    messageType: mapMessageType(messageTypeId),
    messageData: reEncoded,
  };
}

