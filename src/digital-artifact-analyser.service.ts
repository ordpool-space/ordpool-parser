import { AtomicalParserService } from './atomical/atomical-parser.service';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { convertToActivities, contructRuneEtchAttempt, isFlagSetOnTransaction, constructCat21Mint } from './digital-artifact-analyser.service.helper';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { LabitbuParserService } from './labitbu/labitbu-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { isUncommonGoodsMint } from './rune/rune-parser.service.helper';
import { Src20ParserService } from './src20/src20-parser.service';
import { DigitalArtifact, DigitalArtifactType } from './types/digital-artifact';
import { ParsedAtomical } from './types/parsed-atomical';
import { Brc20DeployAttempt, Cat21Mint, getArtifactTypeMap, getEmptyStats, OrdpoolStats, RuneEtchAttempt, Src20DeployAttempt } from './types/ordpool-stats';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { ParsedCat21 } from './types/parsed-cat21';
import { ParsedInscription } from './types/parsed-inscription';
import { ParsedRunestone } from './types/parsed-runestone';
import { BrC20Parsed, getBrc20Flaws, parseBrc20Content } from './types/parsed-brc20';
import { getSrc20Flaws, ParsedSrc20, parseSrc20Content, Src20Parsed } from './types/parsed-src20';
import { TransactionSimple, TransactionSimplePlus } from './types/transaction-simple';


/** Flags for the artifact, plus any already-parsed BRC-20 / SRC-20 content. */
export interface AnalyseResult {
  flags: bigint;
  brc20?: BrC20Parsed;
  src20Content?: Src20Parsed;
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
 * Not supported right now (requires ordinal tracking, which is outside the parser's scope):
 * - ordpool_atomical_transfer (x/y/z operations — needs sat tracking for complete numbers)
 * - ordpool_cat21_transfer
 * - ordpool_inscription_transfer / ordpool_inscription_burn
 * - ordpool_rune_transfer / ordpool_rune_burn
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
   * @returns The OrdpoolStats object with counted amounts for each artifact type.
   */
  static async analyseTransactions(transactions: TransactionSimplePlus[]): Promise<OrdpoolStats> {

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
    let totalLabitbuFees = 0;
    let totalInscriptionMintFees = 0;

    let totalEnvelopeSize = 0;
    let totalContentSize = 0;
    let largestEnvelopeSize = 0;
    let largestContentSize = 0;
    let largestEnvelopeInscriptionId: string | null = null;
    let largestContentInscriptionId: string | null = null;

    // etching/deployments: store all attempts, which might or might not have been successfull
    const runeEtchAttempts: RuneEtchAttempt[] = [];
    const brc20DeployAttempts: Brc20DeployAttempt[] = [];
    const src20DeployAttempts: Src20DeployAttempt[] = [];

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
      let labitbuFeeAdded = false;
      let inscriptionMintFeeAdded = false;

      for (const artifact of artifacts) {
        // Analyse once — returns flags + any parsed intermediate data
        const { flags, brc20, src20Content } = await DigitalArtifactAnalyserService.analyse(artifact);

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

        // ** Atomical Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_atomical) === OrdpoolTransactionFlags.ordpool_atomical) {
          if (!atomicalFeeAdded) {
            totalAtomicalFees += txFee;
            atomicalFeeAdded = true;
          }
        }

        // ** Labitbu Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_labitbu) === OrdpoolTransactionFlags.ordpool_labitbu) {
          if (!labitbuFeeAdded) {
            totalLabitbuFees += txFee;
            labitbuFeeAdded = true;
          }
        }

        // ** Inscription Mint Fees + extra stats for inscriptions
        if ((flags & OrdpoolTransactionFlags.ordpool_inscription_mint) === OrdpoolTransactionFlags.ordpool_inscription_mint) {
          if (!inscriptionMintFeeAdded) {
            totalInscriptionMintFees += txFee;
            inscriptionMintFeeAdded = true;
          }

          const inscription = artifact as ParsedInscription;
          const envelopeSize = inscription.envelopeSize;
          const contentSize = inscription.contentSize;

          totalEnvelopeSize += envelopeSize;
          totalContentSize += contentSize;

          if (envelopeSize > largestEnvelopeSize) {
            largestEnvelopeSize = envelopeSize;
            largestEnvelopeInscriptionId = inscription.inscriptionId;
          }
          if (contentSize > largestContentSize) {
            largestContentSize = contentSize;
            largestContentInscriptionId = inscription.inscriptionId;
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
    }

    // Set final Rune stats
    stats.runes.mostActiveMint = mostActiveRuneMint;
    stats.runes.mostActiveNonUncommonMint = mostActiveNonUncommonRuneMint;
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
    stats.fees.labitbus = totalLabitbuFees;
    stats.fees.inscriptionMints = totalInscriptionMintFees;

    // Set final extra stats for inscriptions
    stats.inscriptions.totalEnvelopeSize = totalEnvelopeSize;
    stats.inscriptions.totalContentSize = totalContentSize;
    stats.inscriptions.largestEnvelopeSize = largestEnvelopeSize;
    stats.inscriptions.largestContentSize = largestContentSize;
    stats.inscriptions.largestEnvelopeInscriptionId = largestEnvelopeInscriptionId;
    stats.inscriptions.largestContentInscriptionId = largestContentInscriptionId;

    const inscriptionCount = stats.amounts.inscriptionMint;
    stats.inscriptions.averageEnvelopeSize = inscriptionCount ? totalEnvelopeSize / inscriptionCount : 0;
    stats.inscriptions.averageContentSize = inscriptionCount ? totalContentSize / inscriptionCount : 0;

    // Store mint activity with counts
    stats.runes.runeMintActivity = convertToActivities(runeMintActivity).sort((a, b) => b[1] - a[1]);
    stats.brc20.brc20MintActivity = convertToActivities(brc20MintActivity).sort((a, b) => b[1] - a[1]);
    stats.src20.src20MintActivity = convertToActivities(src20MintActivity).sort((a, b) => b[1] - a[1]);

    stats.runes.runeEtchAttempts = runeEtchAttempts;
    stats.brc20.brc20DeployAttempts = brc20DeployAttempts;
    stats.src20.src20DeployAttempts = src20DeployAttempts;

    stats.cat21.cat21MintActivity = cat21MintActivity;

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
    let src20Content: any;

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
        flags |= OrdpoolTransactionFlags.ordpool_src721;
        break;

      case DigitalArtifactType.Inscription:
        const inscription = artifact as ParsedInscription;
        flags |= OrdpoolTransactionFlags.ordpool_inscription;
        flags |= OrdpoolTransactionFlags.ordpool_inscription_mint;

        // Check for valid JSON content
        if (
          inscription.contentType?.startsWith('text/plain') ||
          inscription.contentType?.startsWith('application/json')
        ) {

          brc20 = parseBrc20Content(await inscription.getContent()) ?? undefined;
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
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src721);
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
   * @return The updated flags with the appropriate ordpool transaction flags set.
   */
  static async analyseTransaction(tx: TransactionSimple, flags: bigint): Promise<bigint> {

    const artifacts: DigitalArtifact[] = DigitalArtifactsParserService.parse(tx);

    for (const artifact of artifacts) {
      const { flags: ordpoolFlags } = await DigitalArtifactAnalyserService.analyse(artifact);
      flags |= ordpoolFlags;
    }

    return flags;
  }
}


