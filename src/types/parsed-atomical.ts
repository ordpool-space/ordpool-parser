import { DigitalArtifact } from "./digital-artifact";
import { AtomicalOperation } from "../atomical/atomical-parser.service.helper";

export interface ParsedAtomical extends DigitalArtifact {

  /**
   * The detected operation type.
   * 'unknown' means an atomical mark was found but the operation byte didn't match known types.
   */
  operation: AtomicalOperation;

  /**
   * The raw CBOR payload bytes from the envelope (concatenated from all pushdata chunks).
   * Empty Uint8Array if no payload found.
   */
  getPayloadRaw: () => Uint8Array;

  /**
   * The decoded CBOR payload from the atomical envelope.
   * Contains the `args` field (operation parameters) and optional file attachments.
   * null if CBOR decoding fails or no payload found.
   */
  getPayload: () => Record<string, unknown> | null;
}
