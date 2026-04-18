import { bytesToDataUri } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { OnParseError } from '../types/parser-options';
import { ParsedSrc20 } from '../types/parsed-src20';
import { ParsedSrc721 } from '../types/parsed-src721';
import { ParsedSrc101 } from '../types/parsed-src101';
import { ParsedStamp } from '../types/parsed-stamp';
import { extractOlgaData, decryptStampMultisig, detectMimeType } from './stamp-parser.service.helper';

/**
 * Unified parser for the Bitcoin Stamps ecosystem.
 *
 * Detects Stamps (images), SRC-20, SRC-721, and SRC-101 from:
 * 1. OLGA P2WSH encoding (block 833,000+): raw file data in P2WSH outputs
 * 2. ARC4 multisig encoding (block 793,068+): encrypted data with key burn addresses
 *
 * Note: Pre-OLGA Stamps (before block 833,000) are Counterparty issuances
 * with STAMP:<base64> in the description field. Those are detected by the
 * Counterparty parser as issuance messages.
 *
 * Note: The existing Src20ParserService still works for SRC-20 via multisig.
 * This parser additionally detects SRC-101, SRC-721, and Stamps from
 * both encoding paths.
 */
export class StampParserService {

  /**
   * Parses stamp data from a transaction.
   *
   * Detection order (cheapest first):
   * 1. OLGA P2WSH -- raw file data in witness outputs (no decryption)
   * 2. ARC4 multisig -- decrypt pubkey data with key burn addresses
   *
   * Returns the most specific type: ParsedStamp, ParsedSrc20, ParsedSrc721, or ParsedSrc101.
   */
  static parse(transaction: {
    txid: string,
    vin: { txid: string }[],
    vout: { scriptpubkey: string, scriptpubkey_type: string }[]
  }, onError?: OnParseError): ParsedStamp | ParsedSrc20 | ParsedSrc721 | ParsedSrc101 | null {

    try {
      // Path 1: OLGA P2WSH -- extract raw file data from P2WSH outputs (no decryption)
      const fileData = extractOlgaData(transaction.vout);
      if (fileData && fileData.length > 0) {
        const mimeType = detectMimeType(fileData);

        if (mimeType === 'application/json') {
          return StampParserService.parseJsonStamp(transaction.txid, fileData);
        }

        if (mimeType) {
          return StampParserService.createStamp(transaction.txid, fileData, mimeType);
        }

        return StampParserService.createStamp(transaction.txid, fileData, 'application/octet-stream');
      }

      // Path 2: ARC4 multisig -- decrypt stamp content from key-burn multisig outputs
      const content = decryptStampMultisig(transaction);
      if (content) {
        return StampParserService.routeStampContent(transaction.txid, content);
      }

      return null;
    } catch (ex) {
      onError?.(ex);
      return null;
    }
  }

  /**
   * Returns true if the transaction contains stamp data (OLGA or multisig).
   */
  static hasStamp(transaction: {
    txid: string,
    vin: { txid: string }[],
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
      // Fall through to Stamp with JSON content type.
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

    if (protocol === 'src-101') {
      return {
        type: DigitalArtifactType.Src101,
        uniqueId: `${DigitalArtifactType.Src101}-${txid}`,
        transactionId: txid,
        getContent: () => text,
      };
    }

    // JSON but not a known stamp protocol -- treat as Stamp
    return StampParserService.createStamp(txid, fileData, 'application/json');
  }

  /**
   * Routes decrypted stamp content (string from ARC4 multisig path) to the right type.
   * The content has already had the "stamp:" prefix stripped.
   */
  private static routeStampContent(
    txid: string,
    content: string
  ): ParsedSrc20 | ParsedSrc721 | ParsedSrc101 | null {

    let json: any;
    try {
      json = JSON.parse(content);
    } catch {
      // Not JSON -- could be base64 Stamp image from multisig description
      // This path would need further parsing. For now, return null.
      return null;
    }

    const protocol = (json?.p || json?.P || '').toLowerCase();

    if (protocol === 'src-20') {
      return {
        type: DigitalArtifactType.Src20,
        uniqueId: `${DigitalArtifactType.Src20}-${txid}`,
        transactionId: txid,
        getContent: () => content,
      };
    }

    if (protocol === 'src-721') {
      return {
        type: DigitalArtifactType.Src721,
        uniqueId: `${DigitalArtifactType.Src721}-${txid}`,
        transactionId: txid,
        getContent: () => content,
      };
    }

    if (protocol === 'src-101') {
      return {
        type: DigitalArtifactType.Src101,
        uniqueId: `${DigitalArtifactType.Src101}-${txid}`,
        transactionId: txid,
        getContent: () => content,
      };
    }

    return null;
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
