var rc4 = require('arc4');

interface Transaction {
  vin: Array<{ txid: string }>;
  vout: Array<{
    scriptpubkey: string,
    scriptpubkey_type: string
  }>;
}


function hexToBytes(a: string): number[] {
  for (var b = [], c = 0; c < a.length; c += 2)
      b.push(parseInt(a.substr(c, 2), 16));
  return b;
}

function bytesToHex(a: number[]): string {
  for (var b = [], c = 0; c < a.length; c++)
      b.push((a[c] >>> 4).toString(16)),
      b.push((a[c] & 15).toString(16));
  return b.join("")
}

function parseScript (buffer:  number[]): Array<number | number[]> {

  const chunks: Array<number | number[]> = [];
  var i = 0;

  function readChunk(n: number) {
    chunks.push(buffer.slice(i, i + n));
    i += n;
  };

  while (i < buffer.length) {
    var opcode = buffer[i++];
    if (opcode >= 0xF0) {
        opcode = (opcode << 8) | buffer[i++];
    }

    var len;
    if (opcode > 0 && opcode < 76) { //OP_PUSHDATA1
      readChunk(opcode);
    } else if (opcode == 76) { //OP_PUSHDATA1
      len = buffer[i++];
      readChunk(len);
    } else if (opcode == 77) { //
      len = (buffer[i++] << 8) | buffer[i++];
      readChunk(len);
    } else if (opcode == 78) { //OP_PUSHDATA4
      len = (buffer[i++] << 24) | (buffer[i++] << 16) | (buffer[i++] << 8) | buffer[i++];
      readChunk(len);
    } else {
      chunks.push(opcode);
    }

    if(i<0x00){
      break;
    }
  }

  return chunks;
};


/**
 * decodes some parts of the redeemscript of a multisignature transaction
 * but only for OP_CHECKMULTISIG
 * see: https://github.com/OutCast3k/coinbin/blob/cda4559cfd5948dbb18dc078c48a3e62121218e5/js/coin.js#L868
 */
function extractPubkeys(redeemScriptHex: string) {

  // Split the redeem script into chunks
  const bytes = hexToBytes(redeemScriptHex);
  const chunks = parseScript(bytes);

  var pubkeys = [];
  for(var i=1;i < chunks.length-2; i++){
    pubkeys.push(bytesToHex(chunks[i] as number[]));
  }

  return pubkeys;
}

// https://github.com/okx/js-wallet-sdk/blob/05f696a1f9b9577f99d42bccb260ee7107802712/packages/crypto-lib/src/base/hex.ts#L6
export function fromHex(data: string): Buffer {
  if(data.startsWith("0x")) {
      data = data.substring(2)
  }
  return Buffer.from(data, "hex")
}

export function toHex(data: Uint8Array | Buffer | number[], addPrefix: boolean = false): string {
  const buffer = Buffer.from(data)
  return addPrefix? "0x" + buffer.toString("hex") : buffer.toString("hex")
}

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
 *
 * full docs here https://github.com/hydren-crypto/stampchain/blob/main/docs/src20.md#src-20-btc-transaction-specifications
 */
export function decodeSrc20Transaction(transaction: Transaction): string | null {

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

  return decrypted;
}

