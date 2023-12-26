import fs from 'fs';

export function readTransaction(txId: string) {

  const jsonString = fs.readFileSync(`testdata/tx_${txId}.json`, 'utf8');
  const txn = JSON.parse(jsonString);
  return txn;
}

/**
 * Reads a UTF-8 text file and encodes its contents in Base64.
 *
 * @param inscriptionId - The identifier for the inscription.
 * @param fileEnding - The file extension/type.
 * @returns Base64 encoded content of the text file.
 */
export function readInscriptionAsBase64(inscriptionId: string, fileEnding: string): string {
  const filePath = `testdata/inscription_${inscriptionId}.${fileEnding}`;
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return Buffer.from(fileContent, 'utf8').toString('base64');
}

/**
 * Reads a binary file and encodes its contents in Base64.
 *
 * @param inscriptionId - The identifier for the inscription.
 * @param fileEnding - The file extension/type.
 * @returns Base64 encoded content of the binary file.
 */
export function readBinaryInscriptionAsBase64(inscriptionId: string, fileEnding: string): string {
  const filePath = `testdata/inscription_${inscriptionId}.${fileEnding}`;
  const fileContent = fs.readFileSync(filePath);
  return Buffer.from(fileContent).toString('base64');
}

/**
* Reads a binary file and returns its contents as a Uint8Array.
*
* @param fileName - The file name.
* @returns Uint8Array containing the content of the binary file.
*/
export function readBinaryFileAsUint8Array(fileName: string): Uint8Array {
 const filePath = `testdata/${fileName}`;
 return fs.readFileSync(filePath);
}
