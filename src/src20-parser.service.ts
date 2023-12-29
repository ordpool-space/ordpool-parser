import { extractPubkeys, fromHex } from "./src20-parser.service.helper";

var rc4 = require('arc4');

/**
 * Decodes a SRC-20 Bitcoin Transaction
 *
 * see tx_50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1.json as a referene
 *
 * Steps:
 * 1. The transaction ID is the ARC4 key. Warning: it must NOT be reversed!
 * 2. Extract the relevant pubkeys:
 *    03c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e51
 *    039036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976cc
 *    02dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16be3
 *    02932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5ca
 * 3. We strip the sign and nonce bytes (first and last bytes from each string)
 * 4. Now we have as a concatenated string:
 *    c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e
 *    9036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976
 *    dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16b
 *    932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5
 * 4. Decrypt using RC4, Expected result:
 *    00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
 *    which is decoded: --> Estamp:{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}
 * --> E is the length of the data
 *
 * full docs here https://github.com/hydren-crypto/stampchain/blob/main/docs/src20.md#src-20-btc-transaction-specifications
 */
export function decodeSrc20Transaction(transaction: {
  vin: { txid: string }[];
  vout: {
    scriptpubkey: string,
    scriptpubkey_type: string
  }[];
}): string | null {

  try {
    // 1. The transaction ID is the ARC4 key
    const arc4Key = fromHex(transaction.vin[0].txid);

    const pubkeys = transaction.vout
      // 2. Extract the first two pubkeys from multisig scripts
      .filter(vout => vout.scriptpubkey_type === 'multisig')
      .map(vout => {
        const pubkeys = extractPubkeys(vout.scriptpubkey);
        return [pubkeys[0], pubkeys[1]];
      })
      .flat()
      // 3. We strip the sign and nonce bytes (first and last bytes from each string)
      .map(key => key.substring(2, 64))
      .join('');

    // Convert concatenated pubkeys to Buffer
    const pubkeysBuffer = fromHex(pubkeys);

    // 4. Decrypt using RC4
    const cipher = rc4('arc4', arc4Key);
    const decrypted = cipher.decodeString(pubkeysBuffer.toString('hex'));

    // Convert the decrypted string to a hexadecimal format
    let decryptedHex = '';
    for (let i = 0; i < decrypted.length; i++) {
      decryptedHex += decrypted.charCodeAt(i).toString(16).padStart(2, '0');
    }

    // Extract the first two bytes to determine the length
    // The first two bytes, is the expected length of the decoded data in hex
    // (less any trailing zeros) for data validation.
    const expectedLengthHex = decryptedHex.substring(0, 4);
    const expectedLength = parseInt(expectedLengthHex, 16);

    // Remove the first two bytes from the decryptedHex
    // Remove all trailing zeros by cutting away everything after the expectedLength
    const dataHex = decryptedHex.substring(4, 4 + expectedLength * 2);

    // Convert the hex string back to UTF-8
    let result = '';
    for (let i = 0; i < dataHex.length; i += 2) {
      result += String.fromCharCode(parseInt(dataHex.substr(i, 2), 16));
    }

    // the txn it is not valid, if it has not the Bitcoin Stamp transaction prefixed 'stamp:'
    if (!result.includes('stamp:')) {
      return null;
    }

    return result.replace('stamp:', '');

  } catch {
    return null;
  }
}
