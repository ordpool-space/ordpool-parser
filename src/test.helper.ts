import fs from 'fs';

export function readTransaction(txId: string) {

  const jsonString = fs.readFileSync(`testdata/tx_${txId}.json`, 'utf8');
  const txn = JSON.parse(jsonString);
  return txn;
}

/**
 * Reads a UTF-8 text file and encodes its contents in Base64.
 *
 * @param {string} inscriptionId - The identifier for the inscription.
 * @param {string} fileEnding - The file extension/type.
 * @returns {string} Base64 encoded content of the text file.
 */
export function readInscriptionAsBase64(inscriptionId: string, fileEnding: string): string {
  const filePath = `testdata/inscription_${inscriptionId}.${fileEnding}`;
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return Buffer.from(fileContent, 'utf8').toString('base64');
}


/**
 * Reads a binary file and encodes its contents in Base64.
 *
 * @param {string} inscriptionId - The identifier for the inscription.
 * @param {string} fileEnding - The file extension/type.
 * @returns {string} Base64 encoded content of the binary file.
 */
export function readBinaryInscriptionAsBase64(inscriptionId: string, fileEnding: string): string {
  const filePath = `testdata/inscription_${inscriptionId}.${fileEnding}`;
  const fileContent = fs.readFileSync(filePath);
  return Buffer.from(fileContent).toString('base64');
}
