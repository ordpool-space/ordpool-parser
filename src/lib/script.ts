import { OPS_BY_NAME, OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4 } from './op-codes';
import { bytesToHex, hexToBytes } from './conversions';
import { readPushdata } from './reader';

/**
 * Determines if an opcode represents a data push operation.
 *
 * @param opcode - The opcode to evaluate.
 * @returns True if the opcode represents a data push.
 */
function isDataPushOpcode(opcode: number): boolean {
  // Opcodes from 0x01 to 0x4b (decimal values 1 to 75) are special opcodes that indicate a data push is happening.
  return (0x01 <= opcode && opcode <= 0x4b) ||
         (opcode === OP_PUSHDATA1 ||
          opcode === OP_PUSHDATA2 ||
          opcode === OP_PUSHDATA4);
}

/**
 * Parses a Bitcoin script and extracts its components (opcodes and data).
 *
 * Returns a flat array where each element is either:
 * - A number (opcode, e.g. OP_FALSE=0x00, OP_IF=0x63, OP_CHECKSIG=0xac)
 * - A Uint8Array (push data bytes)
 *
 * Used by both the SRC-20 and Counterparty parsers for multisig pubkey extraction
 * and P2TR witness envelope parsing.
 *
 * @param bytes - A Uint8Array representing the script in bytes.
 * @returns An array where each element is either an opcode or a Uint8Array of data bytes.
 */
export function parseScript(bytes: Uint8Array): Array<number | Uint8Array> {
  const chunks: Array<number | Uint8Array> = [];
  let i = 0;

  while (i < bytes.length) {
    const opcode = bytes[i];

    if (isDataPushOpcode(opcode)) {
      // Use readPushdata for handling data push opcodes
      const [data, newPointer] = readPushdata(bytes, i);
      chunks.push(data);
      i = newPointer;
    } else {
      // Handle non-push opcodes
      chunks.push(opcode);
      i++;
    }
  }

  return chunks;
}

/**
 * Extracts public keys from a multisig script as raw byte arrays.
 *
 * Skips the first element (OP_N required signatures) and last two elements
 * (OP_N total keys + OP_CHECKMULTISIG), returning only the embedded pubkeys.
 *
 * Used by the Counterparty parser to avoid the hex round-trip overhead.
 *
 * @param scriptpubkey - The scriptpubkey in hex format
 * @returns An array of public keys as Uint8Array (typically 33 bytes each).
 */
export function extractPubkeysRaw(scriptpubkey: string): Uint8Array[] {

  const bytes = hexToBytes(scriptpubkey);
  const chunks = parseScript(bytes);

  const pubkeys: Uint8Array[] = [];
  for (let i = 1; i < chunks.length - 2; i++) {
    if (typeof chunks[i] !== 'number') {
      pubkeys.push(chunks[i] as Uint8Array);
    }
  }

  return pubkeys;
}

/**
 * Extracts public keys from a multisig script as hex strings.
 *
 * Convenience wrapper around extractPubkeysRaw for callers that need hex strings
 * (e.g. SRC-20 parser which concatenates hex strings for ARC4 decryption).
 *
 * @param hex - The redeem script in hex format
 * @returns An array of public keys as hex strings.
 */
export function extractPubkeys(hex: string): string[] {
  return extractPubkeysRaw(hex).map(bytesToHex);
}

/**
 * Reverse direction of `parseScript`: takes a Bitcoin Script ASM string
 * (e.g. the form ord renders inside `<dd class=monospace>` on its
 * /output and /tx pages, or `bitcoin-cli decodescript`'s `asm` field)
 * and returns the equivalent script bytes as a hex string.
 *
 * Supported token shapes:
 *   - `OP_PUSHBYTES_<N>` where N is 1..75 -- emit byte N (the inline
 *     data-push opcode) followed by the next token's raw hex bytes
 *     (which MUST be 2*N hex chars).
 *   - `OP_PUSHDATA1` / `OP_PUSHDATA2` / `OP_PUSHDATA4` -- emit the
 *     opcode byte plus the appropriate little-endian length prefix
 *     plus the next token's raw hex.
 *   - `OP_PUSHNUM_<N>` for N in 1..16 -- aliases for OP_1..OP_16,
 *     bytes 0x51..0x60.
 *   - Any other named opcode -- looked up in `OPS_BY_NAME`.
 *   - A bare hex literal -- emitted as raw bytes. Used as the operand
 *     immediately after an OP_PUSHBYTES_<N> / OP_PUSHDATA* token.
 *
 * Negative integer literals (`-1`) and decimal literals get a TODO
 * marker -- ord's ASM render never emits those for script_pubkey shapes
 * we care about; if we ever encounter them we'll fail loudly rather
 * than silently produce garbage.
 *
 * Use case: HTML-scraped `script_pubkey` ASM tokens must be re-encoded
 * back to hex to match what `ord server --enable-json-api` emits for
 * /output and /tx endpoints.
 */
export function asmToHex(asm: string): string {
  const tokens = asm.trim().split(/\s+/).filter(t => t.length > 0);
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Inline data-push opcodes: OP_PUSHBYTES_<N> where 1 <= N <= 75.
    // The opcode byte itself IS the length N (in Bitcoin Script).
    if (t.startsWith('OP_PUSHBYTES_')) {
      const n = Number(t.slice('OP_PUSHBYTES_'.length));
      if (!Number.isInteger(n) || n < 1 || n > 75) {
        throw new Error(`asmToHex: bad OP_PUSHBYTES suffix in "${t}"`);
      }
      out += n.toString(16).padStart(2, '0');
      const operand = tokens[++i];
      if (operand === undefined || !/^[0-9a-fA-F]*$/.test(operand)) {
        throw new Error(`asmToHex: ${t} not followed by hex operand`);
      }
      if (operand.length !== n * 2) {
        throw new Error(`asmToHex: ${t} operand length mismatch (got ${operand.length}, want ${n * 2})`);
      }
      out += operand.toLowerCase();
      continue;
    }

    if (t === 'OP_PUSHDATA1') {
      const operand = tokens[++i];
      if (operand === undefined || !/^[0-9a-fA-F]*$/.test(operand)) {
        throw new Error(`asmToHex: OP_PUSHDATA1 not followed by hex operand`);
      }
      const len = operand.length / 2;
      if (len > 0xff) throw new Error(`asmToHex: OP_PUSHDATA1 operand too long (${len} bytes)`);
      out += '4c' + len.toString(16).padStart(2, '0') + operand.toLowerCase();
      continue;
    }
    if (t === 'OP_PUSHDATA2') {
      const operand = tokens[++i];
      if (operand === undefined || !/^[0-9a-fA-F]*$/.test(operand)) {
        throw new Error(`asmToHex: OP_PUSHDATA2 not followed by hex operand`);
      }
      const len = operand.length / 2;
      if (len > 0xffff) throw new Error(`asmToHex: OP_PUSHDATA2 operand too long (${len} bytes)`);
      const lo = (len & 0xff).toString(16).padStart(2, '0');
      const hi = ((len >> 8) & 0xff).toString(16).padStart(2, '0');
      out += '4d' + lo + hi + operand.toLowerCase();
      continue;
    }
    if (t === 'OP_PUSHDATA4') {
      const operand = tokens[++i];
      if (operand === undefined || !/^[0-9a-fA-F]*$/.test(operand)) {
        throw new Error(`asmToHex: OP_PUSHDATA4 not followed by hex operand`);
      }
      const len = operand.length / 2;
      if (len > 0xffffffff) throw new Error(`asmToHex: OP_PUSHDATA4 operand too long (${len} bytes)`);
      const b0 = (len & 0xff).toString(16).padStart(2, '0');
      const b1 = ((len >>> 8) & 0xff).toString(16).padStart(2, '0');
      const b2 = ((len >>> 16) & 0xff).toString(16).padStart(2, '0');
      const b3 = ((len >>> 24) & 0xff).toString(16).padStart(2, '0');
      out += '4e' + b0 + b1 + b2 + b3 + operand.toLowerCase();
      continue;
    }

    // OP_PUSHNUM_<N>: alias for OP_<N> (bytes 0x51..0x60 for N in 1..16).
    if (t.startsWith('OP_PUSHNUM_')) {
      const n = Number(t.slice('OP_PUSHNUM_'.length));
      if (!Number.isInteger(n) || n < 1 || n > 16) {
        throw new Error(`asmToHex: bad OP_PUSHNUM suffix in "${t}"`);
      }
      out += (0x50 + n).toString(16).padStart(2, '0');
      continue;
    }

    // Named opcode in the full table.
    if (Object.prototype.hasOwnProperty.call(OPS_BY_NAME, t)) {
      out += OPS_BY_NAME[t].toString(16).padStart(2, '0');
      continue;
    }

    // Bare hex literal (rare standalone -- usually consumed as an
    // operand above). ord doesn't emit these without a preceding
    // OP_PUSHBYTES_*, but accept them defensively.
    if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
      out += t.toLowerCase();
      continue;
    }

    throw new Error(`asmToHex: unknown ASM token "${t}"`);
  }
  return out;
}
