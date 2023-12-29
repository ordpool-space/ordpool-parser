import CryptoJS from 'crypto-js';

interface Transaction {
  vin: Array<{ txid: string }>;
  vout: Array<{
    scriptpubkey: string,
    scriptpubkey_type: string
  }>;
}

/*
 * RC4 symmetric cipher encryption/decryption
 * seen here: https://gist.github.com/farhadi/2185197
 *
 * @license Public Domain
 * @param string key - secret key for encryption/decryption
 * @param string str - string to be encrypted/decrypted
 * @return string
 */
function rc4(key: string, str: string) {
	var s = [], j = 0, x, res = '';
	for (var i = 0; i < 256; i++) {
		s[i] = i;
	}
	for (i = 0; i < 256; i++) {
		j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
	}
	i = 0;
	j = 0;
	for (var y = 0; y < str.length; y++) {
		i = (i + 1) % 256;
		j = (j + s[i]) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
		res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
	}
	return res;
}

function decodeRedeemScript(redeemScriptHex: string) {
  // This function assumes the redeem script is a standard multisig redeem script
  const pubKeyLength = 66; // Length of a public key in hex

  // Split the redeem script into chunks
  const chunks = [];
  for (let i = 0; i < redeemScriptHex.length; i += 2) {
    chunks.push(redeemScriptHex.substr(i, 2));
  }

  // The first chunk is OP_M, the second-to-last chunk is OP_N, the last chunk is OP_CHECKMULTISIG
  const opM = parseInt(chunks[0], 16) - 80; // Subtract 80 to convert from opcode to integer
  const opN = parseInt(chunks[chunks.length - 2], 16) - 80; // Subtract 80 to convert from opcode to integer

  // Extract the public keys, which are in between OP_M and OP_N
  const pubKeys = [];
  for (let i = 1; i <= opN; i++) {
    const keyStartIndex = i * 2;
    const pubKey = chunks.slice(keyStartIndex, keyStartIndex + (pubKeyLength / 2)).join('');
    pubKeys.push(pubKey);
  }

  return {
    requiredSignatures: opM,
    totalPublicKeys: opN,
    publicKeys: pubKeys
  };
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
 * very, very much inspired from: https://github.com/OutCast3k/coinbin/blob/cda4559cfd5948dbb18dc078c48a3e62121218e5/js/coin.js#L868
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


/**
 * Decodes a SRC-20 Bitcoin Transaction
 *
 * full docs here https://github.com/hydren-crypto/stampchain/blob/main/docs/src20.md#src-20-btc-transaction-specifications
 */
export function decodeSrc20Transaction(transaction: Transaction): string | null {

  // Extract the transaction ID from the first input
  const arc4KeySource = transaction.vin[0].txid;

  // Reverse the transaction ID to get the ARC4 key
  const arc4Key = arc4KeySource.match(/.{2}/g)!.reverse().join('');

  // Pubkeys:
  // 03c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e51
  // 039036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976cc
  // 02dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16be3
  // 02932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5ca

  // Extract the first two pubkeys from multisig scripts
  const pubkeys = transaction.vout
    .filter(vout => vout.scriptpubkey_type === 'multisig')
    .map(vout => {
      const pubkeys = extractPubkeys(vout.scriptpubkey);
      return [pubkeys[0], pubkeys[1]];
    })
    .flat()
    // We strip the sign and nonce bytes (first and last bytes from each string)
    .map(key => key.substring(2, 64));

  // Now we have as a concatenated string:
  // c46b73fe2ff939bea5d0a577950dc8876e863bed11c887d681417dfd70533e
  // 9036c8182c70770f8f6bd702a25c7179bfff1ccb3a844297a717226b88b976
  // dc054e58b755f233295d2a8759a3e4cbf678619d8e75379e7989046dbce16b
  // 932b35a45d21395ac8bb54b8f9dae3fd2dbc309c24e550cf2211fe6aa897e5
  const concatenated = pubkeys.join('');

  // Expected result:
  // 00457374616d703a7b2270223a227372632d3230222c226f70223a227472616e73666572222c227469636b223a225354455645222c22616d74223a22313030303030303030227d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
  // --> Estamp:{"p":"src-20","op":"transfer","tick":"STEVE","amt":"100000000"}

  /*
  // Convert concatenated string to hexadecimal
  const concatenatedHex = concatenated.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');

  // if (!concatenatedHex) {
  //   return null;
  // }

  // Decrypt using RC4 with the key -- does not work?!
  const decrypted = rc4(arc4Key, concatenated);

  // Decrypt using RC4 with the key -- does not work?!
  const decrypted2 = rc4(arc4Key, concatenatedHex!);
  */

  // Convert concatenated hex string to a buffer
  // Convert concatenated string to hexadecimal --DOES ALSO NOT WORK!!
  const concatenatedHex = concatenated.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
  if (!concatenatedHex) {
    return null;
  }

  // Decrypt using RC4
  const encryptedHex = CryptoJS.enc.Hex.parse(concatenatedHex);
  const keyHex = CryptoJS.enc.Utf8.parse(arc4Key);
  const decrypted = CryptoJS.RC4.decrypt({ ciphertext: encryptedHex } as any, keyHex);
  const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

  return decryptedText;

  return null;
}

