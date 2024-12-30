import { AtomicalParserService } from './atomical/atomical-parser.service';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { addEntry, convertToActivities, convertToAttempts, isFlagSetOnTransaction, parseJsonObject } from './digital-artifact-analyser.service.helper';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { isUncommonGoodsMint } from './rune/rune-parser.service.helper';
import { Src20ParserService } from './src20/src20-parser.service';
import { DigitalArtifact, DigitalArtifactType } from './types/digital-artifact';
import { getArtifactTypeMap, getEmptyStats, OrdpoolStats } from './types/ordpool-stats';
import { OrdpoolTransactionFlags } from './types/ordpool-transaction-flags';
import { ParsedInscription } from './types/parsed-inscription';
import { ParsedRunestone } from './types/parsed-runestone';
import { ParsedSrc20 } from './types/parsed-src20';
import { TransactionSimple } from './types/transaction-simple';


/**
 * Returns the corresponding ordpool flags for the given digital asset.
 * This function does an intensive check, with intensive parsing for all supported protocols.
 *
 * Specification for version 1:
 *
 * if the asset is a Cat21
 * -> it should return ordpool_cat21
 * -> it should return ordpool_cat21_mint
 *
 *
 * if the asset is an Atomical
 * -> it should return ordpool_atomical
 *
 *
 * if the asset is a Inscription
 * -> it should return ordpool_inscription
 * -> it should return ordpool_inscription_mint
 * -> if the content type of the inscription is `inscription.contentType.startsWith('text/plain') || inscription.contentType.startsWith('application/json')`
 *    AND and it's valid JSON
 *    AND if the JSON has a property+value `{ "p": "brc-20" }` then it's a supported BRC-20 inscription and should return ordpool_brc20
 *    -> if the JSON of the supported BRC-20 inscription has a property+value `{ "op": "deploy" }` it should return ordpool_brc20_deploy
 *    -> if the JSON of the supported BRC-20 inscription has a property+value `{ "op": "mint" }` it should return ordpool_brc20_mint
 *    -> if the JSON of the supported BRC-20 inscription has a property+value `{ "op": "transfer" }` it should return ordpool_brc20_transfer
 *
 *
 * if the asset is a Runestone
 * -> it should return ordpool_rune
 * -> if the asset is a Runestone and if the `runestone`(type RunestoneSpec) property is set, it's a valid Runestone
 *    -> if it's a valid Runestone AND the `etching` is set, it should return ordpool_rune_etch
 *    -> if it's a valid Runestone AND the `mint` is set, it should return ordpool_rune_etch
 * -> if the asset is a Runestone and if the `cenotaph`(type Cenotaph) property is set, it's an invalid Runestone (also called Cenotaph) and should return ordpool_rune_cenotaph, `etching` or `mint` are not counted
 *
 *
 * if the asset is a SRC-20
 * -> it should return ordpool_src20
 * -> if the content of SRC-20 is valid JSON and if the the JSON has a property+value `{ "p": "src-20" }` then it's supported SRC-20 transaction
 *    -> if the JSON of the supported SRC-20 transaction has a property+value `{ "op": "deploy" }` it should return ordpool_src20_deploy
 *    -> if the JSON of the supported SRC-20 transaction has a property+value `{ "op": "mint" }` it should return ordpool_src20_mint
 *    -> if the JSON of the supported SRC-20 transaction has a property+value `{ "op": "transfer" }` it should return ordpool_src20_transfer
 *
 *
 * Not supported right now:
 * - ordpool_atomical_X (we have no parser for that)
 * - ordpool_cat21_transfer (requires tracking of CAT-21 ordinals)
 * - ordpool_inscription_transfer (requires tracking of inscriptions)
 * - ordpool_inscription_burn (requires tracking of inscriptions)
 * - ordpool_rune_transfer (requires tracking of runes)
 * - ordpool_rune_burn (requires tracking of runes) - we can only recognize burning via Cenotaphs, but this number would be misleading
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
  static async analyseTransactions(transactions: TransactionSimple[]): Promise<OrdpoolStats> {

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
    let totalCat21MintFees = 0;
    let totalAtomicalFees = 0;
    let totalInscriptionMintFees = 0;

    let totalEnvelopeSize = 0;
    let totalContentSize = 0;
    let largestEnvelopeSize = 0;
    let largestContentSize = 0;
    let largestEnvelopeInscriptionId: string | null = null;
    let largestContentInscriptionId: string | null = null;

    // etching/deployments: this allows us to store all attempts for a given identifier
    const runeEtchAttempts: { [identifier: string]: string[] } = {};
    const brc20DeployAttempts: { [ticker: string]: string[] } = {};
    const src20DeployAttempts: { [ticker: string]: string[] } = {};

    for (const tx of transactions) {

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

      for (const artifact of artifacts) {
        const flags = await DigitalArtifactAnalyserService.analyse(artifact);

        // ** Amounts: Iterate over each flag by checking each bit in the flag set
        for (const [flag, statKey] of artifactTypeMap.entries()) {
          // Check if the flag is set using bitwise AND
          if ((flags & flag) === flag) {
            stats.amounts[statKey] = (stats.amounts[statKey] ?? 0) + 1;
          }
        }

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

            var isUncommonGoods = isUncommonGoodsMint(runestone.runestone);
            // Track non-UNCOMMON•GOODS Rune mints
            if (!isUncommonGoods) {
              runeNonUncommonGoodsActivity[mintKey] = (runeNonUncommonGoodsActivity[mintKey] ?? 0) + 1;
              if (runeNonUncommonGoodsActivity[mintKey] > mostActiveNonUncommonRuneMintCount) {
                mostActiveNonUncommonRuneMint = mintKey;
                mostActiveNonUncommonRuneMintCount = runeNonUncommonGoodsActivity[mintKey];
              }
            }

            // Accumulate Rune mint fees if not already added for this transaction
            if (!runeMintFeeAdded) {
              const txFee = tx.fee ?? 0;
              totalRuneMintFees += txFee;
              runeMintFeeAdded = true;
            }

            // Accumulate non-UncommonGoods Rune mint fees if not already added for this transaction
            if (!nonUncommonRuneMintFeeAdded && !isUncommonGoods) {
              const txFee = tx.fee ?? 0;
              totalNonUncommonRuneMintFees += txFee;
              nonUncommonRuneMintFeeAdded = true;
            }
          }
        }

        // ** BRC-20 Mints and Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_brc20_mint) === OrdpoolTransactionFlags.ordpool_brc20_mint) {
          if (!brc20MintFeeAdded) {
            const inscription = artifact as ParsedInscription;
            const parsedContent = parseJsonObject(await inscription.getContent());
            if (parsedContent && parsedContent.p === 'brc-20') {
              const mintKey = parsedContent.tick ?? 'unknown'; // unknown should never happen

              // Track BRC-20 mint activity
              brc20MintActivity[mintKey] = (brc20MintActivity[mintKey] ?? 0) + 1;
              if (brc20MintActivity[mintKey] > mostActiveBrc20MintCount) {
                mostActiveBrc20Mint = mintKey;
                mostActiveBrc20MintCount = brc20MintActivity[mintKey];
              }

              // Accumulate BRC-20 mint fees only once per transaction
              const txFee = tx.fee ?? 0;
              totalBrc20MintFees += txFee;
              brc20MintFeeAdded = true;
            }
          }
        }

        // ** SRC-20 Mints and Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_src20_mint) === OrdpoolTransactionFlags.ordpool_src20_mint) {
          if (!src20MintFeeAdded) {
            const src20 = artifact as ParsedSrc20;
            const parsedSrcContent = parseJsonObject(src20.getContent());
            if (parsedSrcContent && parsedSrcContent.p === 'src-20') {
              const mintKey = parsedSrcContent.tick ?? 'unknown'; // unknown should never happen

              // Track SRC-20 mint activity
              src20MintActivity[mintKey] = (src20MintActivity[mintKey] ?? 0) + 1;
              if (src20MintActivity[mintKey] > mostActiveSrc20MintCount) {
                mostActiveSrc20Mint = mintKey;
                mostActiveSrc20MintCount = src20MintActivity[mintKey];
              }

              // Accumulate SRC-20 mint fees only once per transaction
              const txFee = tx.fee ?? 0;
              totalSrc20MintFees += txFee;
              src20MintFeeAdded = true;
            }
          }
        }

        // ** CAT-21 Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_cat21_mint) === OrdpoolTransactionFlags.ordpool_cat21_mint) {

          // not really necessary, because a transaction can only have one cat
          if (!cat21MintFeeAdded) {
            const txFee = tx.fee ?? 0;
            totalCat21MintFees += txFee;
            cat21MintFeeAdded = true;
          }
        }

        // ** Atomical Fees
        if ((flags & OrdpoolTransactionFlags.ordpool_atomical) === OrdpoolTransactionFlags.ordpool_atomical) {
          if (!atomicalFeeAdded) {
            const txFee = tx.fee ?? 0;
            totalAtomicalFees += txFee;
            atomicalFeeAdded = true;
          }
        }

        // ** Inscription Mint Fees + extra stats for inscriptions
        if ((flags & OrdpoolTransactionFlags.ordpool_inscription_mint) === OrdpoolTransactionFlags.ordpool_inscription_mint) {
          if (!inscriptionMintFeeAdded) {
            const txFee = tx.fee ?? 0;
            totalInscriptionMintFees += txFee;
            inscriptionMintFeeAdded = true;
          }

          const inscription = artifact as ParsedInscription;

          // accessing of the properties only once, to improve performance
          const envelopeSize = inscription.envelopeSize;
          const contentSize = inscription.contentSize;

          // Increment total sizes
          totalEnvelopeSize += envelopeSize;
          totalContentSize += contentSize;

          // Check for largest envelope size
          if (envelopeSize > largestEnvelopeSize) {
            largestEnvelopeSize = envelopeSize;
            largestEnvelopeInscriptionId = inscription.inscriptionId;
          }

          // Check for largest content size
          if (contentSize > largestContentSize) {
            largestContentSize = contentSize;
            largestContentInscriptionId = inscription.inscriptionId;
          }
        }

        // ** Rune Etch Attempts
        if ((flags & OrdpoolTransactionFlags.ordpool_rune_etch) === OrdpoolTransactionFlags.ordpool_rune_etch) {
          const runestone = artifact as ParsedRunestone;
          const runeName = runestone.runestone?.etching?.runeName;
          addEntry(runeEtchAttempts, runeName, tx.txid);
        }

        // ** BRC-20 Deployment Attempts
        if ((flags & OrdpoolTransactionFlags.ordpool_brc20_deploy) === OrdpoolTransactionFlags.ordpool_brc20_deploy) {
          const inscription = artifact as ParsedInscription;
          const parsedContent = parseJsonObject(await inscription.getContent());
          if (parsedContent && parsedContent.p === 'brc-20' && parsedContent.op === 'deploy') {
            const tick = parsedContent.tick;
            addEntry(brc20DeployAttempts, tick, tx.txid);
          }
        }

        // ** SRC-20 Deployment Attempts
        if ((flags & OrdpoolTransactionFlags.ordpool_src20_deploy) === OrdpoolTransactionFlags.ordpool_src20_deploy) {
          const src20 = artifact as ParsedSrc20;
          const parsedContent = parseJsonObject(src20.getContent());
          if (parsedContent && parsedContent.p === 'src-20' && parsedContent.op === 'deploy') {
            const tick = parsedContent.tick;
            addEntry(src20DeployAttempts, tick, tx.txid);
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
    stats.runes.runeMintActivity = convertToActivities(runeMintActivity);
    stats.brc20.brc20MintActivity = convertToActivities(brc20MintActivity);
    stats.src20.src20MintActivity = convertToActivities(src20MintActivity);

    stats.runes.runeEtchAttempts = convertToAttempts(runeEtchAttempts);
    stats.brc20.brc20DeployAttempts = convertToAttempts(brc20DeployAttempts);
    stats.src20.src20DeployAttempts = convertToAttempts(src20DeployAttempts);

    return stats;
  }

  /**
   * Returns the corresponding ordpool flags for the given digital asset.
   * Only used interally by analyseTransactions.
   *
   * @param artifact - The digital artifact to analyze.
   * @returns The corresponding flags for the artifact type (multiple flags can be combined).
   */
  static async analyse(artifact: DigitalArtifact): Promise<bigint> {

    let flags: bigint = BigInt(0);

    switch (artifact.type) {
      case DigitalArtifactType.Cat21:
        flags |= OrdpoolTransactionFlags.ordpool_cat21;
        flags |= OrdpoolTransactionFlags.ordpool_cat21_mint;
        break;

      case DigitalArtifactType.Atomical:
        flags |= OrdpoolTransactionFlags.ordpool_atomical;
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

          // TODO: chaching for improving performance?!
          const parsedContent = parseJsonObject(await inscription.getContent());
          if (parsedContent && parsedContent.p === 'brc-20') {

            flags |= OrdpoolTransactionFlags.ordpool_brc20;

            // Check for specific BRC-20 operations
            if (parsedContent.op === 'deploy') {
              flags |= OrdpoolTransactionFlags.ordpool_brc20_deploy;
            } else if (parsedContent.op === 'mint') {
              flags |= OrdpoolTransactionFlags.ordpool_brc20_mint;
            } else if (parsedContent.op === 'transfer') {
              flags |= OrdpoolTransactionFlags.ordpool_brc20_transfer;
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
        flags |= OrdpoolTransactionFlags.ordpool_src20;

        // TODO: chaching for improving performance?!
        const parsedSrcContent = parseJsonObject(src20.getContent());
        if (parsedSrcContent && parsedSrcContent.p === 'src-20') {
          // Check for SRC-20 operations
          if (parsedSrcContent.op === 'deploy') {
            flags |= OrdpoolTransactionFlags.ordpool_src20_deploy;
          } else if (parsedSrcContent.op === 'mint') {
            flags |= OrdpoolTransactionFlags.ordpool_src20_mint;
          } else if (parsedSrcContent.op === 'transfer') {
            flags |= OrdpoolTransactionFlags.ordpool_src20_transfer;
          }
        }
        break;

      default:
        // No additional flags apply for unsupported types
        break;
    }

    return flags;
  }

  /**
   * Checks for top-level ordpool flags on a transaction (which may or may not have the flags property).
   * The transaction must have already been analysed - otherwise the flags property is null and false will be returned.
   *
   * Since only the top-level ordpool flags are considered,
   * it works with the results from `analyseTransactions` as well as `quickAnalyseTransaction`.
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
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_rune) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_brc20) ||
      isFlagSetOnTransaction(tx, OrdpoolTransactionFlags.ordpool_src20);
  }


  /**
   * Computes and returns the transaction flags for the given transaction.
   * This function ONLY performs a quick check for the general presence of a protocol and attempts to exit early.
   * False-positive matches are possible!
   * It does NOT analyse the artifacts in detail – only our own top-level `OrdpoolTransactionFlags` are set!
   *
   * This function only checks if at least one digital artifacts of any kind
   * (e.g., Atomical, CAT-21, Inscription, Rune, SRC-20 but NOT BRC-20 (since it's already an inscription))
   * is present in the transaction and sets the corresponding flag(s) in the `flags` variable.
   *
   * Previously used in:
   * - ordpool: backend/src/api/common.ts
   * - ordpool: frontend/src/app/shared/transaction.utils.ts
   *
   * @param tx - The transaction to be evaluated for digital artifacts.
   * @param flags - The existing flags to which new flags will be added.
   * @return The updated flags with the appropriate ordpool transaction flags set.
   * @deprecated It's faster, but can have false positive results. It also ignores BRC-20
   */
  static quickAnalyseTransaction(tx: TransactionSimple, flags: bigint): bigint {

    if (AtomicalParserService.hasAtomical(tx)) {
      flags |= OrdpoolTransactionFlags.ordpool_atomical;
    }

    if (Cat21ParserService.hasCat21(tx)) {
      flags |= OrdpoolTransactionFlags.ordpool_cat21;
    }

    if (InscriptionParserService.hasInscription(tx)) {
      flags |= OrdpoolTransactionFlags.ordpool_inscription;
    }

    if (RuneParserService.hasRunestone(tx)) {
      flags |= OrdpoolTransactionFlags.ordpool_rune;
    }

    if (Src20ParserService.hasSrc20(tx)) {
      flags |= OrdpoolTransactionFlags.ordpool_src20;
    }

    return flags;
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
      const ordpoolFlags = await DigitalArtifactAnalyserService.analyse(artifact);

      // Apply ordpoolFlags to the existing flags using bitwise OR
      flags |= ordpoolFlags;
    }

    return flags;
  }
}


