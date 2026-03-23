import fs from 'fs';
import { IEsploraApi } from '../src';
import zlib from 'zlib';


export function readTransaction(txId: string): IEsploraApi.Transaction {

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
 const buffer = fs.readFileSync(filePath);
 // Node's Buffer extends Uint8Array but fails deep equality checks against plain Uint8Array.
 // Wrap in a proper Uint8Array for cross-environment compatibility.
 return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Loads and decompresses a Brotli compressed file into memory.
 *
 * @param filePath - The path to the Brotli compressed file.
 * @returns The decompressed data as a JSON object.
 */
export function loadCompressedJsonData(fileName: string): any {

  const filePath = `testdata/${fileName}`;
  const compressedData = fs.readFileSync(filePath);
  const decompressedData = zlib.brotliDecompressSync(compressedData);

  // Parse the decompressed data as JSON
  return JSON.parse(decompressedData.toString());
}
