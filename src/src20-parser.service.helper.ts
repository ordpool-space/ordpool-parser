export function hexToBytes(a: string): number[] {
  for (var b = [], c = 0; c < a.length; c += 2)
      b.push(parseInt(a.substr(c, 2), 16));
  return b;
}

export function bytesToHex(a: number[]): string {
  for (var b = [], c = 0; c < a.length; c++)
      b.push((a[c] >>> 4).toString(16)),
      b.push((a[c] & 15).toString(16));
  return b.join("")
}

export function parseScript (buffer:  number[]): Array<number | number[]> {

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
export function extractPubkeys(redeemScriptHex: string) {

  // Split the redeem script into chunks
  const bytes = hexToBytes(redeemScriptHex);
  const chunks = parseScript(bytes);

  var pubkeys = [];
  for(var i=1;i < chunks.length-2; i++){
    pubkeys.push(bytesToHex(chunks[i] as number[]));
  }

  return pubkeys;
}
