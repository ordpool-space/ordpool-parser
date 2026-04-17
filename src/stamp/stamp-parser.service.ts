import { bytesToDataUri } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { OnParseError } from '../types/parser-options';
import { ParsedSrc20 } from '../types/parsed-src20';
import { ParsedSrc721 } from '../types/parsed-src721';
import { ParsedStamp } from '../types/parsed-stamp';
import { extractOlgaData, detectMimeType } from './stamp-parser.service.helper';

/**
 * Unified parser for the Bitcoin Stamps ecosystem.
 *
 * Detects Classic Stamps (images), SRC-20, and SRC-721
 * from OLGA P2WSH encoded transactions (block 833,000+).
 *
 * Note: Pre-OLGA SRC-20 tokens (ARC4 multisig with key burns) are handled
 * by the existing Src20ParserService.
 *
 * Note: Pre-OLGA Classic Stamps (before block 833,000) are Counterparty issuances
 * with STAMP:<base64> in the description field. Those are detected by the
 * Counterparty parser as issuance messages.
 */
export class StampParserService {

  /**
   * Parses OLGA P2WSH encoded stamp data from a transaction.
   *
   * Returns the most specific type: ParsedStamp (images), ParsedSrc20, or ParsedSrc721.
   * Returns null if no stamp data is found.
   */
  static parse(transaction: {
    txid: string,
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }, onError?: OnParseError): ParsedStamp | ParsedSrc20 | ParsedSrc721 | null {

    try {
      // Extract raw file data from P2WSH outputs
      const fileData = extractOlgaData(transaction.vout);
      if (!fileData || fileData.length === 0) {
        return null;
      }

      // Route by content type
      const mimeType = detectMimeType(fileData);

      // JSON content: check for SRC-721 or SRC-101
      if (mimeType === 'application/json') {
        return StampParserService.parseJsonStamp(transaction.txid, fileData);
      }

      // Image or HTML content: Classic Stamp
      if (mimeType) {
        return StampParserService.createStamp(transaction.txid, fileData, mimeType);
      }

      // Unknown content type but valid OLGA data: treat as Classic Stamp with unknown type
      return StampParserService.createStamp(transaction.txid, fileData, 'application/octet-stream');
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Returns true if the transaction contains OLGA P2WSH stamp data.
   */
  static hasStamp(transaction: {
    txid: string,
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }): boolean {
    return StampParserService.parse(transaction) !== null;
  }

  private static parseJsonStamp(
    txid: string,
    fileData: Uint8Array
  ): ParsedSrc20 | ParsedSrc721 | ParsedStamp | null {

    const text = new TextDecoder().decode(fileData);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // Detected as JSON by content heuristic but actually invalid JSON.
      // Fall through to Classic Stamp with JSON content type.
      return StampParserService.createStamp(txid, fileData, 'application/json');
    }

    const protocol = (json?.p || json?.P || '').toLowerCase();

    if (protocol === 'src-20') {
      return {
        type: DigitalArtifactType.Src20,
        uniqueId: `${DigitalArtifactType.Src20}-${txid}`,
        transactionId: txid,
        getContent: () => text,
      };
    }

    if (protocol === 'src-721') {
      return {
        type: DigitalArtifactType.Src721,
        uniqueId: `${DigitalArtifactType.Src721}-${txid}`,
        transactionId: txid,
        getContent: () => text,
      };
    }

    // SRC-101 routing: all mainnet SRC-101 transactions (1951 as of April 2026)
    // use ARC4 multisig, NOT OLGA P2WSH. SRC-101 OLGA activates at block 940,000
    // but nobody has used it yet. Per CLAUDE.md: "If you can't find a real transaction,
    // don't claim support." Add SRC-101 routing here when a mainnet tx appears.

    // JSON but not a known stamp protocol -- treat as Classic Stamp
    return StampParserService.createStamp(txid, fileData, 'application/json');
  }

  private static createStamp(
    txid: string,
    fileData: Uint8Array,
    contentType: string
  ): ParsedStamp {
    return {
      type: DigitalArtifactType.Stamp,
      uniqueId: `${DigitalArtifactType.Stamp}-${txid}`,
      transactionId: txid,
      contentType,
      getDataRaw: () => fileData,
      getContent: () => new TextDecoder().decode(fileData),
      getDataUri: () => bytesToDataUri(fileData, contentType),
    };
  }
}
