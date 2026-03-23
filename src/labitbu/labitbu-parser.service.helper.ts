import { hexToBytes } from '../lib/conversions';

// Labitbu NUMS key (Nothing-Up-My-Sleeve) — SHA-256 of "Labitbu".
// This key is provably unspendable and serves as the protocol marker.
// See: https://nums-secp256k1.jaonoctus.dev/?pk=...&method=TAGGED_HASH_KEY&input=Labitbu
const LABITBU_NUMS_KEY_HEX = '96053db5b18967b5a410326ecca687441579225a6d190f398e2180deec6e429e';

// Control block: 33 bytes (1 parity byte + 32 bytes internal key) + 4096 bytes (128 × 32-byte sibling hashes = WebP data)
const LABITBU_CONTROL_BLOCK_HEX_LENGTH = 4129 * 2; // 8258 hex chars

// WebP files start with "RIFF" (52 49 46 46) and contain "WEBP" (57 45 42 50) at byte offset 8
const RIFF_MAGIC_HEX = '52494646';

// Max WebP payload: 4096 bytes = 8192 hex chars
const MAX_WEBP_HEX_LENGTH = 4096 * 2;

/**
 * Checks if a witness array contains a Labitbu image.
 *
 * Detection: witness[2] (the Taproot control block) must be exactly 4129 bytes
 * and contain the Labitbu NUMS key.
 */
export function hasLabitbu(witness: string[]): boolean {
  if (witness.length < 3) {
    return false;
  }

  const controlBlock = witness[2];

  // Control block must be exactly 4129 bytes (8258 hex chars)
  if (controlBlock.length !== LABITBU_CONTROL_BLOCK_HEX_LENGTH) {
    return false;
  }

  // Must contain the Labitbu NUMS key
  return controlBlock.includes(LABITBU_NUMS_KEY_HEX);
}

/**
 * Extracts the WebP image from a Labitbu witness control block.
 *
 * The WebP data is found by searching for the RIFF header ("RIFF" = 52494646)
 * in the control block and extracting up to 4096 bytes from that position.
 *
 * @returns The WebP image as Uint8Array, or null if not found.
 */
export function extractLabitbuImage(witness: string[]): Uint8Array | null {
  if (!hasLabitbu(witness)) {
    return null;
  }

  const controlBlock = witness[2];

  // Find the RIFF header ("RIFF" = 52 49 46 46) — start of the WebP data
  const riffIndex = controlBlock.indexOf(RIFF_MAGIC_HEX);
  if (riffIndex === -1) {
    return null;
  }

  // Extract up to 4096 bytes of WebP data from the RIFF header
  const webpHex = controlBlock.substring(riffIndex, riffIndex + MAX_WEBP_HEX_LENGTH);
  return hexToBytes(webpHex);
}
