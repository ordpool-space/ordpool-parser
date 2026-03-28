import { Arc4 } from '../lib/arc4';
import { bytesToHex, concatUint8Arrays, hexToBytes } from '../lib/conversions';
import { readPushdata } from '../lib/reader';
import { extractPubkeys } from '../src20/src20-parser.service.helper';
import { CounterpartyEncoding, CounterpartyMessageType } from '../types/parsed-counterparty';

// "CNTRPRTY" in ASCII (hex: 434e545250525459)
const CNTRPRTY_PREFIX = new Uint8Array([0x43, 0x4e, 0x54, 0x52, 0x50, 0x52, 0x54, 0x59]);

/**
 * Result of decrypting and validating Counterparty data from a Bitcoin transaction.
 */
export interface CounterpartyDecryptResult {
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

  const bytes = hexToBytes(scriptpubkey);

  // Skip the 0x6a opcode, read the pushdata
  try {
    const [data] = readPushdata(bytes, 1);
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
 * Parses message type ID and payload from decrypted Counterparty data
 * (after the 8-byte CNTRPRTY prefix).
 *
 * Message type ID: 1 byte if 0 < ID < 256, otherwise 4 bytes big-endian.
 * Special case: ID 0 (classic send) uses 4-byte big-endian encoding.
 */
function parseMessageTypeAndData(decrypted: Uint8Array): { messageTypeId: number, messageData: Uint8Array } | null {
  if (decrypted.length < 9) {
    return null;
  }

  // After 8-byte prefix, read message type ID
  const afterPrefix = decrypted.slice(8);

  // Check if first byte could be a short (1-byte) message type ID
  const firstByte = afterPrefix[0];

  // Classic send (ID 0) uses 4-byte encoding: 00 00 00 00
  // All other IDs < 256 use 1-byte encoding
  if (firstByte === 0 && afterPrefix.length >= 4) {
    // 4-byte big-endian ID
    const id = (afterPrefix[0] << 24) | (afterPrefix[1] << 16) | (afterPrefix[2] << 8) | afterPrefix[3];
    return { messageTypeId: id, messageData: afterPrefix.slice(4) };
  }

  // 1-byte ID (most common)
  return { messageTypeId: firstByte, messageData: afterPrefix.slice(1) };
}

/**
 * Maps a Counterparty message type ID to its human-readable name.
 */
export function mapMessageType(id: number): CounterpartyMessageType {
  switch (id) {
    case 0: return 'send';
    case 1: return 'enhanced_send';
    case 10: return 'order';
    case 11: return 'btcpay';
    case 12: return 'dispenser';
    case 20: return 'issuance';
    case 21: return 'issuance_subasset';
    case 30: return 'broadcast';
    case 40: return 'bet';
    case 50: return 'dividend';
    case 60: return 'burn';
    case 70: return 'cancel';
    case 80: return 'rps';
    case 81: return 'rps_resolve';
    case 90: return 'fairminter';
    case 100: return 'utxo';
    case 110: return 'destroy';
    default: return 'unknown';
  }
}

/**
 * Tries to decrypt and validate Counterparty data from OP_RETURN outputs.
 * This is the fastest detection method (decrypt ≤80 bytes, check prefix).
 */
export function tryDecryptOpReturn(
  vout: { scriptpubkey: string, scriptpubkey_type: string }[],
  arc4Key: Uint8Array
): CounterpartyDecryptResult | null {

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

    // Check for CNTRPRTY prefix
    if (!hasCntrprtyPrefix(decrypted)) {
      continue;
    }

    const parsed = parseMessageTypeAndData(decrypted);
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
 * Counterparty multisig format (1-of-3):
 * - First 2 pubkeys are "fake" — contain ARC4-encrypted data
 * - Third pubkey is the sender's real address (for dust reclaim)
 * - Strip first byte (0x02/0x03 curve prefix) and last byte (padding) from each fake pubkey
 * - Concatenate all data bytes across all multisig outputs
 * - ARC4 decrypt → check for CNTRPRTY prefix
 *
 * WARNING: This is expensive — requires decrypting every multisig output.
 * Only call this if OP_RETURN and P2TR detection both failed.
 */
export function tryDecryptMultisig(
  vout: { scriptpubkey: string, scriptpubkey_type: string }[],
  arc4Key: Uint8Array
): CounterpartyDecryptResult | null {

  const dataChunks: Uint8Array[] = [];

  for (const output of vout) {
    if (output.scriptpubkey_type !== 'multisig' && output.scriptpubkey_type !== 'unknown') {
      continue;
    }

    // Extract pubkeys from the multisig script
    const pubkeys = extractPubkeys(output.scriptpubkey);
    if (pubkeys.length < 2) {
      continue;
    }

    // First 2 pubkeys contain data: strip first byte (02/03) and last byte (padding)
    // Each pubkey is 33 bytes (66 hex chars) → 31 data bytes per pubkey
    for (let i = 0; i < Math.min(pubkeys.length - 1, 2); i++) {
      const pubkeyHex = pubkeys[i];
      // Strip first 2 hex chars (1 byte curve prefix) and last 2 hex chars (1 byte padding)
      const dataHex = pubkeyHex.substring(2, pubkeyHex.length - 2);
      dataChunks.push(hexToBytes(dataHex));
    }
  }

  if (dataChunks.length === 0) {
    return null;
  }

  // Concatenate all data chunks
  const concatenated = concatUint8Arrays(dataChunks);

  // ARC4 decrypt
  const arc4 = new Arc4(arc4Key);
  const decrypted = arc4.processBytes(concatenated);

  // The first byte is a length indicator — skip it, then check for CNTRPRTY prefix
  // (per tokenly spec: "Remove the leading byte from deobfuscated result")
  if (decrypted.length < 9) {
    return null;
  }

  const withoutLengthByte = decrypted.slice(1);
  if (!hasCntrprtyPrefix(withoutLengthByte)) {
    return null;
  }

  const parsed = parseMessageTypeAndData(withoutLengthByte);
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

/**
 * Quick check: does this transaction likely contain Counterparty data?
 *
 * For performance, this only checks OP_RETURN (fast decrypt of ≤80 bytes).
 * Multisig detection is expensive and deferred to parse().
 * P2TR detection requires inscription parsing which is done separately.
 */
export function hasCounterparty(
  transaction: {
    vin: { txid: string }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }
): boolean {

  // Quick check: any OP_RETURN output?
  const hasOpReturn = transaction.vout.some(v => v.scriptpubkey_type === 'op_return');
  if (!hasOpReturn) {
    // No OP_RETURN — could still be multisig or P2TR, but we skip those for speed
    // Multisig is checked in parse() only
    return false;
  }

  // Decrypt OP_RETURN and check for CNTRPRTY prefix
  const arc4Key = hexToBytes(transaction.vin[0].txid);
  return tryDecryptOpReturn(transaction.vout, arc4Key) !== null;
}
