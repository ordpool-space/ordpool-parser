import { ParsedInscription } from "./parsed-inscription";

/**
 * Bitcoin Script Opcodes
 * see https://en.bitcoin.it/wiki/Script
 */
const OP_FALSE = 0x00;
const OP_IF = 0x63;
const OP_0 = 0x00;

const OP_PUSHBYTES_3 = 0x03; // not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
const OP_PUSHDATA1 = 0x4c; // The next byte contains the number of bytes to be pushed onto the stack.
const OP_PUSHDATA2 = 0x4d; // The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
const OP_PUSHDATA4 = 0x4e; // The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
const OP_ENDIF = 0x68; // Ends an if/else block.


/**
 * Extracts the first inscription from a Bitcoin transaction.
 * Advanced envelopes with extra data (eg Quadkey inscriptions) are supported, but the extra data is ignored.
 */
export class InscriptionParserService {

  private pointer = 0;
  private raw: Uint8Array = new Uint8Array();

  /**
   * Encodes a 'binary' string to Base64.
   *
   * This function checks for the environment and uses the appropriate method to encode a string to Base64.
   * In a browser environment, it uses `window.btoa`. In a Node.js environment, it uses `Buffer`.
   *
   * @param {string} str - The string to be encoded.
   * @returns {string} The Base64 encoded string.
   */
  static encodeToBase64(str: string) {
    if (typeof window !== 'undefined' && window.btoa) {
      // Browser environment
      return window.btoa(str);
    } else if (typeof Buffer !== 'undefined') {
      // Node.js environment
      return Buffer.from(str, 'binary').toString('base64');
    } else {
      throw new Error('No suitable environment found for Base64 encoding!');
    }
  }

  /**
   * Converts a hex string to a Uint8Array.
   *
   * @param {string} hexStr - The hex string to be converted.
   * @returns {Uint8Array} - The resulting Uint8Array.
   */
  static hexStringToUint8Array(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  }

  /**
   * Convert a Uint8Array to a UTF8 string.
   * @param bytes - The byte array to convert.
   * @returns The corresponding UTF8 string.
   */
  static uint8ArrayToUtf8String(bytes: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  /**
   * Convert a Uint8Array to a string by treating each byte as a character code.
   * It avoids interpreting bytes as UTF-8 encoded sequences.
   * --> Again: it ignores UTF-8 encoding, which is necessary for binary content!
   *
   * Note: This method is different from using `String.fromCharCode(...combinedData)` which can
   * cause a "Maximum call stack size exceeded" error for large arrays due to the limitation of
   * the spread operator in JavaScript. (previously the parser broke here, because of large content)
   *
   * @param bytes - The byte array to convert.
   * @returns The resulting string where each byte value is treated as a direct character code.
   */
  static uint8ArrayToSingleByteChars(bytes: Uint8Array): string {
    let resultStr = '';
    for (let i = 0; i < bytes.length; i++) {
        resultStr += String.fromCharCode(bytes[i]);
    }
    return resultStr;
  }

  /**
   * Reads n bytes from the raw data starting from the current pointer.
   * Also updates the pointer after reading.
   * @param n - The number of bytes to read.
   * @returns The read bytes as Uint8Array.
   */
  private readBytes(n: number): Uint8Array {
    const slice = this.raw.slice(this.pointer, this.pointer + n);
    this.pointer += n;
    return slice;
  }

  /**
   * Identifies the initial position of the ordinal inscription in the raw transaction data.
   *
   * @returns The starting position of the inscription.
   */
  private getInitialPosition(): number {

    // OP_FALSE
    // OP_IF
    // OP_PUSHBYTES_3: This pushes the next 3 bytes onto the stack.
    // 0x6f, 0x72, 0x64: These bytes translate to the ASCII string "ord"
    const inscriptionMark = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);

    const position = this.raw.findIndex((_byte, index) =>
      this.raw.slice(index, index + inscriptionMark.length).every((val, i) => val === inscriptionMark[i])
    );

    if (position === -1) {
      // throw new Error('No ordinal inscription found in transaction');
      return position;
    }
    return position + inscriptionMark.length;
  }

  /**
   * Reads the data using the starting opcode
   *
   * @returns The data extracted based on the opcode.
   */
  readPushdata(): Uint8Array {
    const opcode = this.readBytes(1)[0];

    // Opcodes from 0x01 to 0x4b (decimal values 1 to 75) are special opcodes that indicate a data push is happening.
    // Specifically, they indicate the number of bytes to be pushed onto the stack.
    // This checks if the current opcode represents a direct data push of 1 to 75 bytes.
    // If this condition is true, then read the next opcode number of bytes and treat them as data
    if (0x01 <= opcode && opcode <= 0x4b) {
      return this.readBytes(opcode);
    }

    let numBytes: number;
    switch (opcode) {
      case OP_PUSHDATA1: numBytes = 1; break;
      case OP_PUSHDATA2: numBytes = 2; break;
      case OP_PUSHDATA4: numBytes = 4; break;
      default:
        throw new Error(`Invalid push opcode ${opcode.toString(16)} at position ${this.pointer}`);
    }

    const dataSizeArray = this.readBytes(numBytes);
    let dataSize = 0;
    for (let i = 0; i < numBytes; i++) {
      dataSize |= dataSizeArray[i] << (8 * i);
    }
    return this.readBytes(dataSize);
  }

  /**
   * Super quick check, that returns true if an inscriptionMark is found.
   * @param witness - witness data from vin[0].
   * @returns True if an inscriptionMark is found.
   */
  hasInscription(witness: string[]): boolean {
    const inscriptionMarkHex = '0063036f7264';
    const witnessJoined = witness.join('');
    return witnessJoined.includes(inscriptionMarkHex);
  }

  /**
   * Main function that parses a inscription or returns null.
   * Note: only first vin is recognized, same as stable ord, this might change in the future?
   * @param transaction with witness in vin[0]
   * @returns The inscription as a data-uri or null.
   */
  parseInscription(transaction: { vin: { witness?: string[] }[] }): ParsedInscription | null {

    const witness = transaction.vin[0]?.witness;
    if (!witness) {
      return null;
    }

    const txWitness = witness.join('');
    this.raw = InscriptionParserService.hexStringToUint8Array(txWitness);
    this.pointer = this.getInitialPosition();

    if (this.pointer === -1) {
      // console.log('No Inscription found! ' + txWitness);
      return null;
    }

    try {

      // Process fields until OP_0 is encountered
      const fields: { [key: string]: Uint8Array } = {};
      while (this.pointer < this.raw.length && this.raw[this.pointer] !== OP_0) {
        const tag = InscriptionParserService.uint8ArrayToUtf8String(this.readPushdata());
        const value = this.readPushdata();

        fields[tag] = value;
      }

      // Now we are at the beginning of the body
      // (or at the end of the raw data if there's no body)
      // --> Question: should we allow empty inscriptions? (where the next byte is OP_ENDIF)
      // --> TODO: Research what is ord doing in this edge case!
      if (this.pointer < this.raw.length && this.raw[this.pointer] === OP_0) {
        this.pointer++; // skip OP_0
      }

      // Collect body data until OP_ENDIF
      const data: Uint8Array[] = [];
      while (this.pointer < this.raw.length && this.raw[this.pointer] !== OP_ENDIF) {
        data.push(this.readPushdata());
      }

      const combinedLengthOfAllArrays = data.reduce((acc, curr) => acc + curr.length, 0);
      const combinedData = new Uint8Array(combinedLengthOfAllArrays);

      // Copy all segments from data into combinedData, forming a single contiguous Uint8Array
      let idx = 0;
      for (const segment of data) {
        combinedData.set(segment, idx);
        idx += segment.length;
      }

      // it would make no sense to add UTF-8 to content-type, so no UTF-8 here
      const contentType = InscriptionParserService.uint8ArrayToSingleByteChars(fields['\u0001']);

      // Let's ignore inscriptions without a contentType, because there is no good way to display them
      // we could change this later on, if there are really inscriptions with no contentType but meaningful metadata
      if (!contentType) {
        return null;
      }

      return {
        contentType,

        // fields,

        getContentString() {
          return InscriptionParserService.uint8ArrayToUtf8String(combinedData);
        },

        getData: (): string  => {
          const content = InscriptionParserService.uint8ArrayToSingleByteChars(combinedData);
          return InscriptionParserService.encodeToBase64(content);
        },

        getDataUri: (): string  => {
          const content = InscriptionParserService.uint8ArrayToSingleByteChars(combinedData);
          const fullBase64Data = InscriptionParserService.encodeToBase64(content);
          return `data:${contentType};base64,${fullBase64Data}`;
        }
      };

    } catch (ex) {
      console.error(ex);
      return null;
    }
  }
}
