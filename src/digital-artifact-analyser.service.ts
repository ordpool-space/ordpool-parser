import { AtomicalParserService } from './atomical/atomical-parser.service';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { convertToActivities, contructRuneEtchAttempt, isFlagSetOnTransaction, constructCat21Mint, parseJsonObject } from './digital-artifact-analyser.service.helper';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { LabitbuParserService } from './labitbu/labitbu-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { isUncommonGoodsMint } from './rune/rune-parser.service.helper';
import { Src20ParserService } from './src20/src20-parser.service';
import { DigitalArtifact, DigitalArtifactType } from './types/digital-artifact';
import { ParsedAtomical } from './types/parsed-atomical';
import { ParsedCounterparty } from './types/parsed-counterparty';
import {
  AtomicalOp,
  Brc20DeployAttempt,
  Cat21Mint,
  CounterpartyMessage,
  getArtifactTypeMap,
  getEmptyInscriptionSizeAggregate,
  getEmptyStats,
  InscriptionSizeAggregate,
  OrdpoolStats,
  RuneEtchAttempt,
  Src20DeployAttempt,
} from './types/ordpool-stats';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { ParsedCat21 } from './types/parsed-cat21';
import { ParsedInscription } from './types/parsed-inscription';
import { ParsedRunestone } from './types/parsed-runestone';
import { BrC20Parsed, getBrc20Flaws, parseBrc20Content } from './types/parsed-brc20';
import { getSrc20Flaws, ParsedSrc20, parseSrc20Content, Src20Parsed } from './types/parsed-src20';
import { OrdpoolFlagged, TransactionSimple, TransactionSimplePlus } from './types/transaction-simple';


/** Flags for the artifact, plus any already-parsed BRC-20 / SRC-20 content. */
export interface AnalyseResult {
  flags: bigint;
  brc20?: BrC20Parsed;
  src20Content?: Src20Parsed;
}

/**
 * Mutates an `InscriptionSizeAggregate` accumulator with one inscription's
 * envelope + content metrics. Used both for the global aggregate and for the
 * per-content-type bucket aggregates (image/text/json).
 */
function updateSizeAggregate(agg: InscriptionSizeAggregate, inscription: ParsedInscription): void {
  agg.totalEnvelopeSize += inscription.envelopeSize;
  agg.totalContentSize  += inscription.contentSize;

  if (inscription.envelopeSize > agg.largestEnvelopeSize) {
    agg.largestEnvelopeSize = inscription.envelopeSize;
    agg.largestEnvelopeInscriptionId = inscription.inscriptionId;
  }
  if (inscription.contentSize > agg.largestContentSize) {
    agg.largestContentSize = inscription.contentSize;
    agg.largestContentInscriptionId = inscription.inscriptionId;
  }
}

/**
 * Returns a finalised copy of the aggregate with averages filled in from the
 * supplied inscription count. Mutating helper kept separate so the analyser's
 * per-loop accumulator stays a pure totals/maxes structure.
 */
function finaliseSizeAggregate(agg: InscriptionSizeAggregate, count: number): InscriptionSizeAggregate {
  return {
    ...agg,
    averageEnvelopeSize: count ? agg.totalEnvelopeSize / count : 0,
    averageContentSize:  count ? agg.totalContentSize  / count : 0,
  };
}

/**
 * Reported when an individual artifact's analysis throws (e.g. corrupt brotli
 * Huffman table inside an inscription's compressed body). The remaining
 * artifacts in the same transaction are still processed; the consumer gets
 * notified so it can log / count the skip.
 */
export interface AnalyseArtifactErrorContext {
  txid: string;
  artifactIndex: number;
  artifactType: DigitalArtifactType;
  error: unknown;
}

export interface AnalyseTransactionOptions {
  onArtifactError?: (ctx: AnalyseArtifactErrorContext) => void;
}

/**
 * Analyses digital artifacts and returns ordpool transaction flags.
 *
 * Specification for version 1:
 *
 * if the asset is a Cat21
 * -> it should return ordpool_cat21
 * -> it should return ordpool_cat21_mint
 *
 * if the asset is an Atomical
 * -> it should return ordpool_atomical
 * -> if the operation creates a new atomical (nft, ft, dft, dmt, dat) -> ordpool_atomical_mint
 * -> if the operation modifies an existing atomical (mod, evt, sl) -> ordpool_atomical_update
 *
 * if the asset is a Labitbu
 * -> it should return ordpool_labitbu
 *
 * if the asset is an Inscription
 * -> it should return ordpool_inscription
 * -> it should return ordpool_inscription_mint
 * -> if the content type starts with 'text/plain' or 'application/json'
 *    AND the content is valid JSON with `{ "p": "brc-20" }`, it should return ordpool_brc20
 *    -> `{ "op": "deploy" }` -> ordpool_brc20_deploy
 *    -> `{ "op": "mint" }` -> ordpool_brc20_mint
 *    -> `{ "op": "transfer" }` -> ordpool_brc20_transfer
 *
 * if the asset is a Runestone
 * -> it should return ordpool_rune
 * -> if the `runestone` (type RunestoneSpec) property is set, it's a valid Runestone
 *    -> if the `etching` is set -> ordpool_rune_etch
 *    -> if the `mint` is set -> ordpool_rune_mint
 * -> if the `cenotaph` (type Cenotaph) property is set, it's an invalid Runestone
 *    -> ordpool_rune_cenotaph (`etching` or `mint` are not counted for cenotaphs)
 *
 * if the asset is a SRC-20
 * -> if the content is valid JSON with `{ "p": "src-20" }`, it should return ordpool_src20
 *    -> `{ "op": "deploy" }` -> ordpool_src20_deploy
 *    -> `{ "op": "mint" }` -> ordpool_src20_mint
 *    -> `{ "op": "transfer" }` -> ordpool_src20_transfer
 *
 *
 * Transfer / burn detection for inscription, cat21 and rune is intentionally
 * absent: a stateless tx parser cannot identify those events without sat
 * tracking, which only an indexer can do. Atomicals x/y/z (FT UTXO
 * splat/split/custom-color) are detectable from the witness alone but the
 * counts only make sense alongside sat tracking, so they're skipped too.
 */
export class DigitalArtifactAnalyserService {

  static readonly version = 1;

  /**
   * Analyzes an array of transactions, parses digital artifacts,
   * and returns an OrdpoolStats object with counted amounts for each artifact type.
   * These counted amounts are stored in the blocks table, too.
   *
   * Used by the backend in the Blocks class:
   * - ordpool: backend/src/api/blocks.ts
   *
   * Compatible with Blocks.$updateBlocks() --> Blocks.$getBlockExtended
   * (this one calls the method with a list of transactions)
   *
   * NOT Compatible with Blocks.$indexBlock --> Blocks.$getBlockExtended
   * (this one calls the method only with a list of one transaction, which is the coinbase txn)
   *
   * @param transactions - The array of transactions to analyze.
   * @param options - Optional callback for per-artifact errors. The decoder
   *   layer (brotli/gzip) is already lenient, but a future parser bug could
   *   still throw on a single artifact. We catch at the artifact granularity
   *   so the rest of the block still classifies; the consumer (ordpool-backend)
   *   can use `onArtifactError` to log the skip.
   * @returns The OrdpoolStats object with counted amounts for each artifact type.
   */
  static async analyseTransactions(transactions: TransactionSimplePlus[], options?: AnalyseTransactionOptions): Promise<OrdpoolStats> {

    const artifactTypeMap = getArtifactTypeMap();

    // Initialize OrdpoolStats with null for unknown fields,
    // to be dynamically updated for known fields
    const stats: OrdpoolStats = getEmptyStats();
    stats.version = this.version;


    // Rune mint activity tracking
    const runeMintActivity: { [key: string]: number } = {};
    const runeNonUncommonGoodsActivity: { [key: string]: number } = {};
    let totalRuneMintFees = 0;
    let totalNonUncommonRuneMintFees = 0;
    let mostActiveRuneMint = null;
    let mostActiveRuneMintCount = 0;
    let mostActiveNonUncommonRuneMint = null;
    let mostActiveNonUncommonRuneMintCount = 0;

    // BRC-20 mint activity tracking
    const brc20MintActivity: { [key: string]: number } = {};
    let totalBrc20MintFees = 0;
    let mostActiveBrc20Mint = null;
    let mostActiveBrc20MintCount = 0;

    // SRC-20 mint activity tracking
    const src20MintActivity: { [key: string]: number } = {};
    let totalSrc20MintFees = 0;
    let mostActiveSrc20Mint = null;
    let mostActiveSrc20MintCount = 0;

    // Fees tracking for different artifact types
    const cat21MintActivity: Cat21Mint[] = [];
    let totalCat21MintFees = 0;
    let totalAtomicalFees = 0;
    let totalInscriptionMintFees = 0;

    // Per-content-type inscription mint fees. Each tx is attributed to AT MOST
    // one bucket (the first inscription mint's canonical bucket — see the
    // bucket-priority comment in the per-artifact loop below). The three
    // sub-totals therefore sum to ≤ totalInscriptionMintFees.
    let totalInscriptionImageMintFees = 0;
    let totalInscriptionTextMintFees = 0;
    let totalInscriptionJsonMintFees = 0;

    // Per-content-type size aggregates. Buckets are mutually exclusive at
    // the size-routing layer (priority json > image > text — see the loop)
    // so the per-bucket totals sum to the global total minus inscriptions
    // that don't match any bucket. Counts are tracked separately to compute
    // averages at the end (a bucket can be "all zero envelope sizes" so we
    // can't recover the count from totalEnvelopeSize alone).
    const globalSizeAgg: InscriptionSizeAggregate = getEmptyInscriptionSizeAggregate();
    const imageSizeAgg: InscriptionSizeAggregate = getEmptyInscriptionSizeAggregate();
    const textSizeAgg: InscriptionSizeAggregate = getEmptyInscriptionSizeAggregate();
    const jsonSizeAgg: InscriptionSizeAggregate = getEmptyInscriptionSizeAggregate();
    let globalInscriptionCount = 0;
    let imageInscriptionCount = 0;
    let textInscriptionCount = 0;
    let jsonInscriptionCount = 0;

    // Inscription compression telemetry — what fraction of inscription weight
    // is compressed, and which encoders dominate? Read from the inscription's
    // declared `Content-Encoding` field (tag 9 of the envelope).
    let inscriptionsBrotliCount = 0;
    let inscriptionsGzipCount = 0;
    let inscriptionsCompressedEnvelopeBytes = 0;

    // etching/deployments: store all attempts, which might or might not have been successfull
    const runeEtchAttempts: RuneEtchAttempt[] = [];
    const brc20DeployAttempts: Brc20DeployAttempt[] = [];
    const src20DeployAttempts: Src20DeployAttempt[] = [];

    // Per-tx satellite arrays. atomicalOps records every atomical operation
    // (mint or update); counterpartyMessages records every CNTRPRTY message.
    // The backend writes these to dedicated satellite tables for per-op /
    // per-message-type charts.
    const atomicalOps: AtomicalOp[] = [];
    const counterpartyMessages: CounterpartyMessage[] = [];

    // index is zero-based, we start at -1 so that the 1st txn has number 0
    let txIndex = -1;
    for (const tx of transactions) {
      txIndex++;

      const artifacts: DigitalArtifact[] = DigitalArtifactsParserService.parse(tx);

      // Flags to track whether fees have been added for this transaction.
      // If we are summing fees separately for each artifact within the same transaction,
      // we will end up over-counting the fees, especially when multiple assets share the same transaction.
      // We need to count the fee once per transaction and distribute it accordingly.
      let runeMintFeeAdded = false;
      let nonUncommonRuneMintFeeAdded = false;
      let brc20MintFeeAdded = false;
      let src20MintFeeAdded = false;
      let cat21MintFeeAdded = false;
      let atomicalFeeAdded = false;
      let inscriptionMintFeeAdded = false;
      // Per-bucket fee is counted at most once per tx, attributed to the
      // bucket of the first inscription mint we encounter. See bucket
      // priority logic below.
      let inscriptionBucketFeeAdded = false;

      // Accumulate per-tx ordpool flags across all artifacts.
      // After the loop, we store them on tx._ordpoolFlags so that upstream's
      // getTransactionFlags() (sync) can pick them up without being made async.
      // This avoids cascading async/await changes through 15+ upstream files.
      // See backend/.claude/CLAUDE.md "HARD RULE: Ordpool Flags Must Be Applied Everywhere".
      let txOrdpoolFlags: bigint = 0n;

      let artifactIndex = -1;
      for (const artifact of artifacts) {
        artifactIndex++;

        // Analyse once — returns flags + any parsed intermediate data.
        // Per-artifact try/catch is defense in depth: the brotli/gzip decoders
        // are already lenient (see brotliDecodeUint8Array/gzipDecode), but a
        // future bug in any parser path must not lose the rest of the block.
        let analysed: AnalyseResult;
        try {
          analysed = await DigitalArtifactAnalyserService.analyse(artifact);
        } catch (error) {
          options?.onArtifactError?.({
            txid: tx.txid,
            artifactIndex,
            artifactType: artifact.type,
            error,
          });
          continue;
        }
        const { flags, brc20, src20Content } = analysed;

        txOrdpoolFlags |= flags;

        // ** Amounts: Iterate over each flag by checking each bit in the flag set
        for (const [flag, statKey] of artifactTypeMap.entries()) {
          if ((flags & flag) === flag) {
            stats.amounts[statKey] = (stats.amounts[statKey] ?? 0) + 1;
          }
        }

        const txFee = tx.fee ?? 0;

        // ** Rune Mints and Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_rune_mint) === OrdpoolTransactionFlags.ordpool_rune_mint) {
          const runestone = artifact as ParsedRunestone;
          if (runestone.runestone?.mint) {
            const { block, tx: mintTx } = runestone.runestone.mint;
            const mintKey = `${block.toString()}:${mintTx}`;

            // Track Rune mint activity
            runeMintActivity[mintKey] = (runeMintActivity[mintKey] ?? 0) + 1;
            if (runeMintActivity[mintKey] > mostActiveRuneMintCount) {
              mostActiveRuneMint = mintKey;
              mostActiveRuneMintCount = runeMintActivity[mintKey];
            }

            const isUncommonGoods = isUncommonGoodsMint(runestone.runestone);
            // Track non-UNCOMMON•GOODS Rune mints
            if (!isUncommonGoods) {
              runeNonUncommonGoodsActivity[mintKey] = (runeNonUncommonGoodsActivity[mintKey] ?? 0) + 1;
              if (runeNonUncommonGoodsActivity[mintKey] > mostActiveNonUncommonRuneMintCount) {
                mostActiveNonUncommonRuneMint = mintKey;
                mostActiveNonUncommonRuneMintCount = runeNonUncommonGoodsActivity[mintKey];
              }
            }

            // Accumulate fees only once per transaction
            if (!runeMintFeeAdded) {
              totalRuneMintFees += txFee;
              runeMintFeeAdded = true;
            }
            if (!nonUncommonRuneMintFeeAdded && !isUncommonGoods) {
              totalNonUncommonRuneMintFees += txFee;
              nonUncommonRuneMintFeeAdded = true;
            }
          }
        }

        // ** BRC-20 Mints and Fees — uses brc20 from analyse() (no re-parse!)
        if ((flags & OrdpoolTransactionFlags.ordpool_brc20_mint) === OrdpoolTransactionFlags.ordpool_brc20_mint) {
          if (!brc20MintFeeAdded && brc20) {
            const mintKey = brc20.tick ?? 'unknown';

            brc20MintActivity[mintKey] = (brc20MintActivity[mintKey] ?? 0) + 1;
            if (brc20MintActivity[mintKey] > mostActiveBrc20MintCount) {
              mostActiveBrc20Mint = mintKey;
              mostActiveBrc20MintCount = brc20MintActivity[mintKey];
            }

            totalBrc20MintFees += txFee;
            brc20MintFeeAdded = true;
          }
        }

        // ** SRC-20 Mints and Fees — uses src20Content from analyse() (no re-parse!)
        if ((flags & OrdpoolTransactionFlags.ordpool_src20_mint) === OrdpoolTransactionFlags.ordpool_src20_mint) {
          if (!src20MintFeeAdded && src20Content) {
            const mintKey = src20Content.tick ?? 'unknown';

            src20MintActivity[mintKey] = (src20MintActivity[mintKey] ?? 0) + 1;
            if (src20MintActivity[mintKey] > mostActiveSrc20MintCount) {
              mostActiveSrc20Mint = mintKey;
              mostActiveSrc20MintCount = src20MintActivity[mintKey];
            }

            totalSrc20MintFees += txFee;
            src20MintFeeAdded = true;
          }
        }

        // ** CAT-21 Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_cat21_mint) === OrdpoolTransactionFlags.ordpool_cat21_mint) {
          const cat = artifact as ParsedCat21;
          const cat21Mint = constructCat21Mint(cat, txIndex, tx);

          if (cat21Mint) {
            cat21MintActivity.push(cat21Mint);
          }

          if (!cat21MintFeeAdded) {
            totalCat21MintFees += txFee;
            cat21MintFeeAdded = true;
          }
        }

        // ** Atomical Fees + per-op satellite row
        if ((flags & OrdpoolTransactionFlags.ordpool_atomical) === OrdpoolTransactionFlags.ordpool_atomical) {
          if (!atomicalFeeAdded) {
            totalAtomicalFees += txFee;
            atomicalFeeAdded = true;
          }

          // Record one row per atomical artifact for the satellite table.
          // Ticker comes from CBOR `args.request_ticker` (FT-family ops);
          // null for ops that don't carry one. getArgs() may return null
          // if CBOR decoding fails — defensive read.
          const atomical = artifact as ParsedAtomical;
          let ticker: string | null = null;
          try {
            const args = atomical.getArgs();
            const rawTicker = args?.['request_ticker'];
            if (typeof rawTicker === 'string' && rawTicker.length > 0) {
              ticker = rawTicker;
            }
          } catch {
            // CBOR decoding failed; leave ticker null, keep the op record.
          }
          atomicalOps.push({
            txId: tx.txid,
            operation: atomical.operation,
            ticker,
          });
        }

        // ** Counterparty per-message satellite row
        if ((flags & OrdpoolTransactionFlags.ordpool_counterparty) === OrdpoolTransactionFlags.ordpool_counterparty) {
          const counterparty = artifact as ParsedCounterparty;
          counterpartyMessages.push({
            txId: tx.txid,
            messageType: counterparty.messageType,
            messageTypeId: counterparty.messageTypeId,
            encoding: counterparty.encoding,
          });
        }

        // ** Inscription Mint Fees + extra stats for inscriptions
        if ((flags & OrdpoolTransactionFlags.ordpool_inscription_mint) === OrdpoolTransactionFlags.ordpool_inscription_mint) {
          if (!inscriptionMintFeeAdded) {
            totalInscriptionMintFees += txFee;
            inscriptionMintFeeAdded = true;
          }

          const inscription = artifact as ParsedInscription;

          // Bucket priority for size + fee attribution: json > image > text.
          // The flags themselves are NOT mutually exclusive (a text/plain
          // BRC-20 mint fires both ordpool_inscription_text AND
          // ordpool_inscription_json). For the per-bucket SIZE aggregates
          // and FEE attribution we want exclusive routing so per-bucket
          // sums are sane — JSON is the most specific signal, take it
          // first. The amounts.inscription{Image,Text,Json} counters keep
          // their independent per-flag semantics; only the size + fee
          // aggregates use this bucket priority.
          let bucket: 'image' | 'text' | 'json' | null = null;
          if ((flags & OrdpoolTransactionFlags.ordpool_inscription_json) === OrdpoolTransactionFlags.ordpool_inscription_json) {
            bucket = 'json';
          } else if ((flags & OrdpoolTransactionFlags.ordpool_inscription_image) === OrdpoolTransactionFlags.ordpool_inscription_image) {
            bucket = 'image';
          } else if ((flags & OrdpoolTransactionFlags.ordpool_inscription_text) === OrdpoolTransactionFlags.ordpool_inscription_text) {
            bucket = 'text';
          }

          updateSizeAggregate(globalSizeAgg, inscription);
          globalInscriptionCount++;

          if (bucket === 'json')  { updateSizeAggregate(jsonSizeAgg,  inscription); jsonInscriptionCount++; }
          if (bucket === 'image') { updateSizeAggregate(imageSizeAgg, inscription); imageInscriptionCount++; }
          if (bucket === 'text')  { updateSizeAggregate(textSizeAgg,  inscription); textInscriptionCount++; }

          if (!inscriptionBucketFeeAdded && bucket !== null) {
            if (bucket === 'json')  { totalInscriptionJsonMintFees += txFee; }
            if (bucket === 'image') { totalInscriptionImageMintFees += txFee; }
            if (bucket === 'text')  { totalInscriptionTextMintFees += txFee; }
            inscriptionBucketFeeAdded = true;
          }

          // Compression: read the inscription's declared Content-Encoding.
          // Empty / unknown encodings count as uncompressed. Optional-chain
          // the method call so test fixtures that stub a partial
          // ParsedInscription don't trip — production parses always supply it.
          const encoding = inscription.getContentEncoding?.();
          if (encoding === 'br') {
            inscriptionsBrotliCount++;
            inscriptionsCompressedEnvelopeBytes += inscription.envelopeSize;
          } else if (encoding === 'gzip') {
            inscriptionsGzipCount++;
            inscriptionsCompressedEnvelopeBytes += inscription.envelopeSize;
          }
        }

        // ** Rune Etch Attempts
        if ((flags & OrdpoolTransactionFlags.ordpool_rune_etch) === OrdpoolTransactionFlags.ordpool_rune_etch) {
          const runestone = artifact as ParsedRunestone;
          const runeEtchAttempt = contructRuneEtchAttempt(tx.txid, tx.status.block_height ?? -1, txIndex, runestone.runestone?.etching)
          if (runeEtchAttempt) {
            runeEtchAttempts.push(runeEtchAttempt);
          }
        }

        // ** BRC-20 Deployment Attempts — uses brc20 from analyse() (no re-parse!)
        if ((flags & OrdpoolTransactionFlags.ordpool_brc20_deploy) === OrdpoolTransactionFlags.ordpool_brc20_deploy) {
          if (brc20 && brc20.op === 'deploy') {
            brc20DeployAttempts.push({
              txId: tx.txid,
              ticker: brc20.tick ?? 'ERROR',
              maxSupply: brc20.max ?? 'ERROR',
              mintLimit: brc20.lim,
              decimals: brc20.dec,
            });
          }
        }

        // ** SRC-20 Deployment Attempts — uses src20Content from analyse() (no re-parse!)
        if ((flags & OrdpoolTransactionFlags.ordpool_src20_deploy) === OrdpoolTransactionFlags.ordpool_src20_deploy) {
          if (src20Content && src20Content.op === 'deploy') {
            src20DeployAttempts.push({
              txId: tx.txid,
              ticker: src20Content.tick ?? 'ERROR',
              maxSupply: src20Content.max ?? 'ERROR',
              mintLimit: src20Content.lim ?? 'ERROR',
              decimals: src20Content.dec,
            });
          }
        }
      }

      // Store pre-computed ordpool flags on the transaction object.
      // This is the key to avoiding async/await cascading in the upstream mempool codebase:
      // upstream's getTransactionFlags() stays sync and reads tx._ordpoolFlags via a 3-line HACK.
      (tx as TransactionSimplePlus & OrdpoolFlagged)._ordpoolFlags = Number(txOrdpoolFlags);
    }

    // Rune stats ship in pairs (overall + non-uncommon). UNCOMMON•GOODS
    // (rune 1:0, no premine, no cap, mintable forever) dominates every
    // "most active" / "top mint count" stat in ~every block.
    stats.runes.mostActiveMint = mostActiveRuneMint;
    stats.runes.mostActiveNonUncommonMint = mostActiveNonUncommonRuneMint;
    stats.runes.uniqueMintsCount = Object.keys(runeMintActivity).length;
    stats.runes.uniqueMintsCountNonUncommon = Object.keys(runeNonUncommonGoodsActivity).length;
    stats.runes.topMintCount = mostActiveRuneMintCount;
    stats.runes.topMintCountNonUncommon = mostActiveNonUncommonRuneMintCount;
    stats.fees.runeMints = totalRuneMintFees;
    stats.fees.nonUncommonRuneMints = totalNonUncommonRuneMintFees;

    // Set final BRC-20 stats
    stats.brc20.mostActiveMint = mostActiveBrc20Mint;
    stats.fees.brc20Mints = totalBrc20MintFees;

    // Set final SRC-20 stats
    stats.src20.mostActiveMint = mostActiveSrc20Mint;
    stats.fees.src20Mints = totalSrc20MintFees;

    // Set fees for other artifact types
    stats.fees.cat21Mints = totalCat21MintFees;
    stats.fees.atomicals = totalAtomicalFees;
    stats.fees.inscriptionMints = totalInscriptionMintFees;
    stats.fees.inscriptionImageMints = totalInscriptionImageMintFees;
    stats.fees.inscriptionTextMints  = totalInscriptionTextMintFees;
    stats.fees.inscriptionJsonMints  = totalInscriptionJsonMintFees;

    // Set final extra stats for inscriptions — global aggregate + 3 per-bucket
    // aggregates, all averaged by their respective bucket-inscription counts.
    stats.inscriptions = {
      ...finaliseSizeAggregate(globalSizeAgg, globalInscriptionCount),
      image: finaliseSizeAggregate(imageSizeAgg, imageInscriptionCount),
      text:  finaliseSizeAggregate(textSizeAgg,  textInscriptionCount),
      json:  finaliseSizeAggregate(jsonSizeAgg,  jsonInscriptionCount),
      brotliCount: inscriptionsBrotliCount,
      gzipCount:   inscriptionsGzipCount,
      compressedEnvelopeBytes: inscriptionsCompressedEnvelopeBytes,
    };

    // Store mint activity with counts
    stats.runes.runeMintActivity = convertToActivities(runeMintActivity).sort((a, b) => b[1] - a[1]);
    stats.brc20.brc20MintActivity = convertToActivities(brc20MintActivity).sort((a, b) => b[1] - a[1]);
    stats.src20.src20MintActivity = convertToActivities(src20MintActivity).sort((a, b) => b[1] - a[1]);

    stats.runes.runeEtchAttempts = runeEtchAttempts;
    stats.brc20.brc20DeployAttempts = brc20DeployAttempts;
    stats.src20.src20DeployAttempts = src20DeployAttempts;

    stats.cat21.cat21MintActivity = cat21MintActivity;
    stats.atomicals.atomicalOps = atomicalOps;
    stats.counterparty.counterpartyMessages = counterpartyMessages;

    // CAT-21 block aggregates derived from the per-cat satellite array.
    // All NULLable for blocks without cats. Note: cat *numbers* are NOT
    // computed here — sequence numbers come from cat21-ord / cat21-indexer
    // downstream and are out of ordpool-parser's scope. Only fields the
    // parser can derive from the tx + traits (genesis trait is hash-derived;
    // fee rate is per-tx) are included.
    if (cat21MintActivity.length > 0) {
      let genesisCount = 0;
      let feeRateSum = 0;
      let minFeeRate = Infinity;
      let maxFeeRate = -Infinity;

      for (const cat of cat21MintActivity) {
        if (cat.traits.genesis) {
          genesisCount++;
        }
        feeRateSum += cat.feeRate;
        if (cat.feeRate < minFeeRate) { minFeeRate = cat.feeRate; }
        if (cat.feeRate > maxFeeRate) { maxFeeRate = cat.feeRate; }
      }

      stats.cat21.genesisCount = genesisCount;
      stats.cat21.avgFeeRate = feeRateSum / cat21MintActivity.length;
      stats.cat21.minFeeRate = minFeeRate;
      stats.cat21.maxFeeRate = maxFeeRate;
    }

    return stats;
  }

  /**
   * Returns the corresponding ordpool flags and any parsed intermediate data
   * for the given digital asset. Parsed data (BRC-20, SRC-20) is returned
   * alongside flags so that callers don't need to re-parse the same content.
   *
   * @param artifact - The digital artifact to analyze.
   * @returns Flags + parsed data for the artifact.
   */
  static async analyse(artifact: DigitalArtifact): Promise<AnalyseResult> {

    let flags: bigint = BigInt(0);
    let brc20: BrC20Parsed | undefined;
    let src20Content: Src20Parsed | undefined;

    switch (artifact.type) {
      case DigitalArtifactType.Cat21:
        flags |= OrdpoolTransactionFlags.ordpool_cat21;
        flags |= OrdpoolTransactionFlags.ordpool_cat21_mint;
        break;

      case DigitalArtifactType.Atomical:
        flags |= OrdpoolTransactionFlags.ordpool_atomical;

        // Distinguish mints from updates based on the operation type
        const atomical = artifact as ParsedAtomical;
        switch (atomical.operation) {
          // Create new atomicals — these are mints
          case 'nft':
          case 'ft':
          case 'dft':
          case 'dmt':
          case 'dat':
            flags |= OrdpoolTransactionFlags.ordpool_atomical_mint;
            break;

          // Modify existing atomicals — these are updates
          case 'mod':
          case 'evt':
          case 'sl':
            flags |= OrdpoolTransactionFlags.ordpool_atomical_update;
            break;

          // x/y/z are FT UTXO transfers — skipped (needs sat tracking for complete numbers)
        }
        break;

      case DigitalArtifactType.Labitbu:
        flags |= OrdpoolTransactionFlags.ordpool_labitbu;
        break;

      case DigitalArtifactType.Counterparty:
        flags |= OrdpoolTransactionFlags.ordpool_counterparty;
        break;

      case DigitalArtifactType.Stamp:
        flags |= OrdpoolTransactionFlags.ordpool_stamp;
        break;

      case DigitalArtifactType.Src721:
        // SRC-721 is a Stamps-family protocol -- always set ordpool_stamp as parent
        // (same pattern as ordpool_inscription parent for ordpool_brc20).
        flags |= OrdpoolTransactionFlags.ordpool_stamp;
        flags |= OrdpoolTransactionFlags.ordpool_src721;
        break;

      case DigitalArtifactType.Src101:
        flags |= OrdpoolTransactionFlags.ordpool_stamp;
        flags |= OrdpoolTransactionFlags.ordpool_src101;
        break;

      case DigitalArtifactType.Inscription:
        const inscription = artifact as ParsedInscription;
        flags |= OrdpoolTransactionFlags.ordpool_inscription;
        flags |= OrdpoolTransactionFlags.ordpool_inscription_mint;

        // Content-type bucket flags. Cheap (contentType is already known on the
        // ParsedInscription), useful for "what kind of inscriptions get inscribed?"
        // charts. _image / _text / _json coexist with _mint -- a mint of an image
        // sets both _mint and _image.
        const contentType = inscription.contentType;
        if (contentType) {
          if (contentType.startsWith('image/')) {
            flags |= OrdpoolTransactionFlags.ordpool_inscription_image;
          } else if (
            contentType.startsWith('text/plain') ||
            contentType.startsWith('text/html') ||
            contentType.startsWith('text/markdown') ||
            contentType.startsWith('text/css') ||
            contentType.startsWith('text/javascript') ||
            contentType.startsWith('application/javascript') ||
            contentType.startsWith('application/x-javascript')
          ) {
            flags |= OrdpoolTransactionFlags.ordpool_inscription_text;
          }
        }

        // Check for valid JSON content
        if (
          contentType?.startsWith('text/plain') ||
          contentType?.startsWith('application/json')
        ) {

          // getContent() decompresses brotli/gzip-encoded bodies. It never throws --
          // see brotliDecodeUint8Array / gzipDecode: corrupt or mis-labeled streams
          // return INVALID_COMPRESSED_DATA_MESSAGE as UTF-8 bytes. ord avoids the
          // problem by never decompressing on its own (raw bytes only, brotli-bomb
          // safe); we have to decompress because we read the content here. On
          // malformed input the sentinel string won't match parseJsonObject or
          // parseBrc20Content, so no false-positive sub-flags fire.
          const inscriptionContent = await inscription.getContent();

          // _json fires whenever the body parses as a JSON object. It coexists
          // with _text when the contentType is text/plain (BRC-20 etc.).
          if (parseJsonObject(inscriptionContent)) {
            flags |= OrdpoolTransactionFlags.ordpool_inscription_json;
          }

          brc20 = parseBrc20Content(inscriptionContent) ?? undefined;
          if (brc20) {

            flags |= OrdpoolTransactionFlags.ordpool_brc20;

            // Validate BRC-20 content -- skip operation flags for invalid BRC-20 (garbage JSON).
            // Invalid BRC-20 still gets the top-level ordpool_brc20 flag (it IS a BRC-20 attempt),
            // but without operation flags it won't pollute deploy/mint/transfer stats or DB inserts.
            const brc20Flaws = getBrc20Flaws(brc20);
            if (brc20Flaws.length === 0) {
              if (brc20.op === 'deploy') {
                flags |= OrdpoolTransactionFlags.ordpool_brc20_deploy;
              } else if (brc20.op === 'mint') {
                flags |= OrdpoolTransactionFlags.ordpool_brc20_mint;
              } else if (brc20.op === 'transfer') {
                flags |= OrdpoolTransactionFlags.ordpool_brc20_transfer;
              }
            }
          }
        }
        break;

      case DigitalArtifactType.Runestone:
        const runestone = artifact as ParsedRunestone;

        flags |= OrdpoolTransactionFlags.ordpool_rune;

        // Valid Runestone with RunestoneSpec
        if (runestone.runestone) {
          if (runestone.runestone.etching) {
            flags |= OrdpoolTransactionFlags.ordpool_rune_etch;
          }
          if (runestone.runestone.mint) {
            flags |= OrdpoolTransactionFlags.ordpool_rune_mint;
          }
        }

        // Invalid Runestone (Cenotaph)
        // runestone.cenotaph.etching and runestone.cenotaph.mint are not counted!
        if (runestone.cenotaph) {
          flags |= OrdpoolTransactionFlags.ordpool_rune_cenotaph;
        }
        break;

      case DigitalArtifactType.Src20:
        const src20 = artifact as ParsedSrc20;

        // SRC-20 is a Stamps-family protocol -- always set ordpool_stamp as parent
        // (same pattern as ordpool_inscription parent for ordpool_brc20).
        flags |= OrdpoolTransactionFlags.ordpool_stamp;

        src20Content = parseSrc20Content(src20.getContent()) ?? undefined;
        if (src20Content) {

          flags |= OrdpoolTransactionFlags.ordpool_src20;

          // Validate SRC-20 content -- skip operation flags for invalid SRC-20 (garbage JSON).
          // Same pattern as BRC-20: invalid SRC-20 still gets the top-level flag,
          // but without operation flags it won't pollute stats or DB inserts.
          const src20Flaws = getSrc20Flaws(src20Content);
          if (src20Flaws.length === 0) {
            if (src20Content.op === 'deploy') {
              flags |= OrdpoolTransactionFlags.ordpool_src20_deploy;
            } else if (src20Content.op === 'mint') {
              flags |= OrdpoolTransactionFlags.ordpool_src20_mint;
            } else if (src20Content.op === 'transfer') {
              flags |= OrdpoolTransactionFlags.ordpool_src20_transfer;
            }
          }
        }
        break;

      default:
        // No additional flags apply for unsupported types
        break;
    }

    return { flags, brc20, src20Content };
  }

  /**
   * Checks for top-level ordpool flags on a transaction (which may or may not have the flags property).
   * The transaction must have already been analysed - otherwise the flags property is null and false will be returned.
   *
   * Since only the top-level ordpool flags are considered,
   * it works with the results from `analyseTransactions` as well as `analyseTransaction`.
   *
   * Used by the BlockOverviewTooltipComponent:
   * - ordpool: frontend/src/app/components/block-overview-tooltip/block-overview-tooltip.component.ts
   *
   * @param tx - The transaction to check.
   * @returns True if one or more of our ordpool flags are set, false otherwise.
   */
  static hasAnyOrdpoolFlag(tx: { flags?: number | null }): boolean {

    if (!tx.flags) {
      return false;
    }

    return isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_atomical) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_cat21) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_inscription) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_labitbu) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_counterparty) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_rune) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_brc20) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src20) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_stamp) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src721) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src101);
  }


  /**
   * Computes and returns the transaction flags for the given transaction.
   *
   * Used in:
   * - ordpool: backend/src/api/common.ts
   * - ordpool: frontend/src/app/shared/transaction.utils.ts
   *
   * @param tx - The transaction to be evaluated for digital artifacts.
   * @param flags - The existing flags to which new flags will be added.
   * @param options - Optional callback for per-artifact errors (see
   *   `analyseTransactions`).
   * @return The updated flags with the appropriate ordpool transaction flags set.
   */
  static async analyseTransaction(tx: TransactionSimple, flags: bigint, options?: AnalyseTransactionOptions): Promise<bigint> {

    const artifacts: DigitalArtifact[] = DigitalArtifactsParserService.parse(tx);

    let txOrdpoolFlags: bigint = 0n;
    let artifactIndex = -1;
    for (const artifact of artifacts) {
      artifactIndex++;
      try {
        const { flags: ordpoolFlags } = await DigitalArtifactAnalyserService.analyse(artifact);
        txOrdpoolFlags |= ordpoolFlags;
      } catch (error) {
        options?.onArtifactError?.({
          txid: tx.txid,
          artifactIndex,
          artifactType: artifact.type,
          error,
        });
      }
    }

    // Side effect: store ordpool-only flags on the tx object.
    // Same pattern as analyseTransactions() -- enables sync getTransactionFlags() in upstream code.
    (tx as TransactionSimple & OrdpoolFlagged)._ordpoolFlags = Number(txOrdpoolFlags);

    flags |= txOrdpoolFlags;
    return flags;
  }
}


