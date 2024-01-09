import { Arc4 } from "./lib/arc4";
import { bigEndianBytesToNumber, unicodeStringToBytes } from "./lib/conversions";
import { bytesToUnicodeString } from './lib/conversions';
import { extractPubkeys } from './src20-parser.service.helper';
import { DigitalArtifactType } from "./types/digital-artifact";
import { ParsedSrc20 } from "./types/parsed-src20";

/**
 * Service to parse SRC-20 Bitcoin Transactions.
 *
 * The full offical specification can be found here:
 * https://github.com/hydren-crypto/stampchain/blob/main/docs/src20.md#src-20-btc-transaction-specifications
 *
 * The offical specification uses the following transaction as an example!
 * see tx_50aeb77245a9483a5b077e4e7506c331dc2f628c22046e7d2b4c6ad6c6236ae1.json
 *
 * Important Steps:
 * 1. The transaction ID is the ARC4 key. Warning: it must NOT be reversed!
 *    Hint: this code helped me to figure this out:
 *    https://github.com/okx/js-wallet-sdk/blob/f32a5d7675637a9e53a26ae844427ec654ffd4f8/packages/coin-bitcoin/src/src20.ts#L77
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
 *    which is decoded: --> stamp:{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}
 */
export class Src20ParserService {

  static parseSrc20Transaction(transaction: {
    txid: string;
    vin: { txid: string }[];
    vout: {
      scriptpubkey: string,
      scriptpubkey_type: string
    }[];
  }): ParsedSrc20 | null {

    try {
      // 1. The transaction ID is the ARC4 key
      const arc4Key = Buffer.from(transaction.vin[0].txid, 'hex');

      const concatenatedPubkeys = transaction.vout
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

      // 4. Decrypt using RC4
      const cipher = new Arc4(arc4Key);
      const decryptedStr = cipher.decodeString(concatenatedPubkeys);

      // This is finally in hex:
      // 00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
      const decrypted = unicodeStringToBytes(decryptedStr);

      // Extract the first two bytes to determine the length
      // The first two bytes, is the expected length of the decoded data in hex
      // (less any trailing zeros) for data validation.
      const expectedLength = bigEndianBytesToNumber(decrypted.slice(0, 2));

      const data = decrypted.slice(2, 2 + expectedLength);

      const result = bytesToUnicodeString(data);
      if (!result || !result.includes('stamp:')) {
        return null;
      }

      const content = result.replace('stamp:', '');

      return {
        type: DigitalArtifactType.Src20,
        transactionId: transaction.txid,
        getContent: () => content
      }

    } catch(error) {
      console.log(error);
      return null;
    }
  }
}
