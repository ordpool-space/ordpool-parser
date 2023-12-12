import fs from 'fs';

export function readTransaction(txId: string) {

  const jsonString = fs.readFileSync(`testdata/tx_${txId}.json`, 'utf8');
  const txn = JSON.parse(jsonString);
  return txn;
}

export function readInscriptionAsBase64(inscriptionId: string, fileEnding: string) {

  const file = fs.readFileSync(`testdata/inscription_${inscriptionId}.${fileEnding}`, 'utf8');
  const fileData = Buffer.from(file).toString('base64');
  return fileData;
}
