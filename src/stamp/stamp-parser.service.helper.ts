import { bigEndianBytesToNumber, hexToBytes, concatUint8Arrays } from '../lib/conversions';

/**
 * Extracts raw file data from OLGA P2WSH outputs.
 *
 * OLGA (Octet Linked Graphics & Artifacts) encodes data directly in P2WSH
 * output scriptpubkeys. Each output is 34 bytes: 0x00 0x20 + 32 bytes of data.
 * The 32-byte "hash" is NOT a real hash -- it's raw file data.
 *
 * Format:
 * 1. Collect all v0_p2wsh scriptpubkeys (skip index 0 -- reserved for destination)
 * 2. Strip the 0x0020 prefix from each, giving 32 raw bytes per output
 * 3. Concatenate, strip trailing zeros
 * 4. First 2 bytes = big-endian file length
 * 5. Remaining bytes = raw file data
 *
 * Two flavors exist on mainnet:
 * a) Counterparty-issued stamps (Classic Stamps, SRC-721 via CP):
 *    Raw file data directly (PNG, GIF, SVG, JSON). No stamp: prefix.
 * b) Direct Bitcoin stamps (SRC-20 OLGA, SRC-101 OLGA):
 *    Data starts with "stamp:" prefix, followed by the file content.
 *
 * Source: stampchain-io/btc_stamps indexer/src/index_core/transaction_utils.py
 * Active since block 833,000 (CP_P2WSH_FEAT_BLOCK_START)
 */
export function extractOlgaData(
  vout: { scriptpubkey: string, scriptpubkey_type: string }[]
): Uint8Array | null {

  // Collect P2WSH outputs at index > 0 (index 0 is reserved for destination/value)
  // P2WSH scriptpubkey format: 0020 + 32 bytes = 68 hex chars total
  const chunks: Uint8Array[] = [];
  for (let i = 1; i < vout.length; i++) {
    const output = vout[i];
    if (output.scriptpubkey_type !== 'v0_p2wsh') {
      continue;
    }
    // Must be exactly 68 hex chars (34 bytes: 0x00 0x20 + 32 data bytes)
    if (output.scriptpubkey.length !== 68) {
      continue;
    }
    // Skip the 0020 prefix (4 hex chars), extract 32 raw bytes
    chunks.push(hexToBytes(output.scriptpubkey.substring(4)));
  }

  if (chunks.length === 0) {
    return null;
  }

  const allBytes = concatUint8Arrays(chunks);

  // Strip trailing zeros (padding)
  let end = allBytes.length;
  while (end > 0 && allBytes[end - 1] === 0) {
    end--;
  }
  if (end < 2) {
    return null;
  }
  const trimmed = allBytes.subarray(0, end);

  // First 2 bytes = big-endian file length
  const fileLength = bigEndianBytesToNumber(trimmed.subarray(0, 2));
  if (fileLength === 0 || fileLength > trimmed.length - 2) {
    return null;
  }

  // Extract the file data (skip 2-byte length prefix)
  const fileData = trimmed.subarray(2, 2 + fileLength);

  // Check for "stamp:" prefix (0x7374616d703a) -- used by SRC-20/SRC-101 OLGA
  // Counterparty-issued OLGA stamps do NOT have this prefix.
  const STAMP_PREFIX = new Uint8Array([0x73, 0x74, 0x61, 0x6d, 0x70, 0x3a]); // "stamp:"
  if (fileData.length > STAMP_PREFIX.length &&
      fileData[0] === 0x73 && fileData[1] === 0x74 && fileData[2] === 0x61 &&
      fileData[3] === 0x6d && fileData[4] === 0x70 && fileData[5] === 0x3a) {
    // Strip the stamp: prefix
    return fileData.subarray(STAMP_PREFIX.length);
  }

  // No stamp: prefix -- return raw file data (Counterparty-issued OLGA)
  return fileData;
}

/**
 * Detects the MIME type from raw file bytes by checking magic numbers.
 *
 * This is the same approach used by the stampchain indexer
 * (enhanced_mime_detection.py) but simplified for our use case.
 */
export function detectMimeType(data: Uint8Array): string | null {
  if (data.length < 4) {
    return null;
  }

  // PNG: 89 50 4e 47 0d 0a 1a 0a
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'image/png';
  }

  // GIF87a or GIF89a: 47 49 46 38 (37|39) 61
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return 'image/webp';
  }

  // JPEG: ff d8 ff
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }

  // BMP: 42 4d (BM)
  if (data[0] === 0x42 && data[1] === 0x4d) {
    return 'image/bmp';
  }

  // Text-based formats: check as UTF-8
  try {
    const head = new TextDecoder().decode(data.subarray(0, Math.min(data.length, 256)));
    const trimmed = head.trimStart();

    // SVG: starts with '<svg' or '<?xml'
    if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
      return 'image/svg+xml';
    }

    // HTML: starts with '<!doctype html', '<html', '<head', '<body'
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html') ||
        lower.startsWith('<head') || lower.startsWith('<body')) {
      return 'text/html';
    }

    // JSON: starts with '{' or '['
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'application/json';
    }
  } catch {
    // not valid UTF-8
  }

  return null;
}
