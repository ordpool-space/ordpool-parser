import fs from 'fs';
import { DigitalArtifactAnalyserService, AnalyseArtifactErrorContext } from './digital-artifact-analyser.service';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { DigitalArtifactType } from './types/digital-artifact';
import { ParsedInscription } from './types/parsed-inscription';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { INVALID_COMPRESSED_DATA_MESSAGE, MAX_DECOMPRESSED_SIZE_MESSAGE } from './lib/brotli-decode';
import { InscriptionPreviewService, isDecodeFailureSentinel } from './inscription/inscription-preview.service';
import { IEsploraApi } from './types/mempool';

/**
 * Block 869,599 tx 5125c1...4634 declares Content-Encoding: br on its
 * inscription but the body is gzip-magic bytes (1f 8b 08 00 ... ; gunzips
 * to "Hello World!"). Our previous parser threw "Corrupted Huffman code
 * histogram" out of analyseTransaction(), which made the ordpool-backend
 * batch processor lose the entire tx (no flags at all) and pause for 2
 * minutes between retries.
 *
 * ord's default content-serving path (src/subcommand/server/r.rs
 * `content_response`) doesn't decompress at all -- it just sets
 * Content-Encoding: br and ships the raw bytes; the browser silently
 * fails and renders the bytes as UTF-8 with replacement characters
 * (verified live on https://ordinals.com/inscription/...i0). We mirror
 * that pass-through behavior in brotliDecodeUint8Array / gzipDecode.
 */
function readCorruptBrotliFixture(): IEsploraApi.Transaction {
  const path = 'testdata/corrupt-brotli-block-869599-5125c1269bd9c4605764fe76d253078d4c35897646004b8fa9837ad41e94a634.json';
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

describe('analyseTransaction with malformed inscription compression', () => {

  it('does not throw on the corrupt-brotli inscription in block 869,599', async () => {
    const tx = readCorruptBrotliFixture();
    await expect(DigitalArtifactAnalyserService.analyseTransaction(tx, 0n)).resolves.not.toThrow?.();
  });

  it('inscription.getContent() returns INVALID_COMPRESSED_DATA_MESSAGE on the corrupt body', async () => {
    const tx = readCorruptBrotliFixture();
    const artifacts = DigitalArtifactsParserService.parse(tx);

    const inscription = artifacts.find(a => a.type === DigitalArtifactType.Inscription) as ParsedInscription | undefined;
    expect(inscription).toBeDefined();

    expect(await inscription!.getContent()).toBe(INVALID_COMPRESSED_DATA_MESSAGE);
  });

  it('returns inscription flags for the corrupt-brotli tx (not zero)', async () => {
    const tx = readCorruptBrotliFixture();

    const flags = await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n);

    // Exact value: ordpool_inscription | ordpool_inscription_mint | ordpool_inscription_text.
    // - inscription / _mint: envelope is parseable, the broken bit is only the body.
    // - _text:               contentType is text/plain, which fires the text bucket
    //                        from the contentType alone (no decode required).
    // - _json:               must NOT fire -- the raw fallback bytes don't parse as JSON.
    // - brc20 / _brc20_*:    must NOT fire -- the raw fallback bytes don't match BRC-20 schema.
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_text
    );
  });

  it('does not invoke onArtifactError -- the decoder layer is lenient, no throw to catch', async () => {
    const tx = readCorruptBrotliFixture();
    const errors: AnalyseArtifactErrorContext[] = [];
    await DigitalArtifactAnalyserService.analyseTransaction(tx, 0n, {
      onArtifactError: (ctx) => errors.push(ctx),
    });
    expect(errors).toEqual([]);
  });

  it('analyseTransactions completes for a batch containing the corrupt-brotli tx', async () => {
    const tx = readCorruptBrotliFixture();

    // analyseTransactions expects TransactionSimplePlus (with status block_height etc.).
    // The fixture has the full Esplora shape so the cast is safe in test code.
    const stats = await DigitalArtifactAnalyserService.analyseTransactions([tx as any]);

    // The artifact was successfully classified -- inscriptionMint is counted.
    expect(stats.amounts.inscriptionMint).toBe(1);
    expect(stats.amounts.inscription).toBe(1);
    // _text bucket counted via the same iteration (getArtifactTypeMap entry).
    expect(stats.amounts.inscriptionText).toBe(1);
    // _json bucket NOT counted -- raw fallback bytes don't parse as JSON.
    expect(stats.amounts.inscriptionJson ?? 0).toBe(0);
  });
});

describe('decode-failure sentinel detection helper', () => {

  it('detects INVALID_COMPRESSED_DATA_MESSAGE as invalid-data', () => {
    expect(isDecodeFailureSentinel(INVALID_COMPRESSED_DATA_MESSAGE)).toBe('invalid-data');
  });

  it('detects MAX_DECOMPRESSED_SIZE_MESSAGE as size-limit', () => {
    expect(isDecodeFailureSentinel(MAX_DECOMPRESSED_SIZE_MESSAGE)).toBe('size-limit');
  });

  it('returns null for any other string', () => {
    expect(isDecodeFailureSentinel('Hello World!')).toBeNull();
    expect(isDecodeFailureSentinel('')).toBeNull();
    expect(isDecodeFailureSentinel('{"p":"brc-20"}')).toBeNull();
    // Substring of the sentinel must not match -- exact string only.
    expect(isDecodeFailureSentinel('Error: invalid')).toBeNull();
  });
});

describe('InscriptionPreviewService on the corrupt-brotli inscription', () => {

  function getCorruptInscription(): ParsedInscription {
    const tx = readCorruptBrotliFixture();
    const artifacts = DigitalArtifactsParserService.parse(tx);
    const inscription = artifacts.find(a => a.type === DigitalArtifactType.Inscription) as ParsedInscription | undefined;
    if (!inscription) throw new Error('fixture has no inscription');
    return inscription;
  }

  it('getContentTypeInstructions returns whatToShow=decode-failure with reason=invalid-data', async () => {
    const inscription = getCorruptInscription();

    const instructions = await InscriptionPreviewService.getContentTypeInstructions(inscription);

    expect(instructions.whatToShow).toBe('decode-failure');
    expect(instructions.reason).toBe('invalid-data');
    expect(instructions.content).toBeUndefined();
  });

  it('getPreview returns the decode-failure HTML and never the sentinel string', async () => {
    const inscription = getCorruptInscription();

    const preview = await InscriptionPreviewService.getPreview(inscription);

    // renderDirectly must be false -- we never let the iframe load /preview/ for
    // a malformed inscription, otherwise the browser would just render garbage
    // bytes (which is what we're trying to avoid).
    expect(preview.renderDirectly).toBe(false);

    // Failure HTML contains the human-readable headline for invalid-data.
    expect(preview.previewContent).toContain('Inscription content cannot be decoded');

    // The sentinel string itself MUST NOT leak into the iframe HTML -- if it
    // did, that would mean a downstream preview function embedded the sentinel
    // bytes into a data URI. The whole point of the short-circuit is to avoid
    // exactly that.
    expect(preview.previewContent).not.toContain(INVALID_COMPRESSED_DATA_MESSAGE);

    // Same for the base64 of the sentinel bytes -- catches the case where
    // getDataUri()-based preview functions accidentally bypass the short-circuit.
    const sentinelBase64 = Buffer.from(INVALID_COMPRESSED_DATA_MESSAGE, 'utf8').toString('base64');
    expect(preview.previewContent).not.toContain(sentinelBase64);
  });
});
