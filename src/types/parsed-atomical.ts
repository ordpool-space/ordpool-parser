import { DigitalArtifact } from "./digital-artifact";
import { AtomicalOperation } from "../atomical/atomical-parser.service.helper";

/**
 * A file attachment embedded in an Atomicals CBOR payload.
 * The CBOR map stores files as `{ "image.png": { $ct: "image/png", $b: <binary> } }`.
 */
export interface AtomicalFile {
  name: string;
  contentType: string;
  data: Uint8Array;

  /** The file data as a UTF-8 encoded string. */
  getContent: () => string;

  /** The file data, base64 encoded. */
  getData: () => string;

  /** Base64 data URI, e.g. 'data:image/png;base64,...' */
  getDataUri: () => string;
}

export interface ParsedAtomical extends DigitalArtifact {

  /**
   * The detected operation type.
   * 'unknown' means an atomical mark was found but the operation byte didn't match known types.
   */
  operation: AtomicalOperation;

  /**
   * The raw CBOR payload bytes (concatenated from all pushdata chunks).
   */
  getPayloadRaw: () => Uint8Array;

  /**
   * The operation parameters from the CBOR `args` field.
   * DFT example: `{ request_ticker: "atom", mint_amount: 1000, ... }`
   * NFT example: `{ request_realm: "terafab", bitworkc: "8857", ... }`
   * null if CBOR decoding fails or no args found.
   */
  getArgs: () => Record<string, unknown> | null;

  /**
   * File attachments embedded in the CBOR payload (images, SVGs, etc.).
   * Each file has a name, contentType and raw binary data.
   */
  getFiles: () => AtomicalFile[];
}
