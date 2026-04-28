import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from '../inscription/inscription-parser.service';
import { bytesToHex, isStringInArrayOfStrings } from '../lib/conversions';
import { DigitalArtifactType } from '../types/digital-artifact';
import { RuneParserService } from './rune-parser.service';
import { isReservedRuneName, removeSpacers, RuneFlaw } from './rune-parser.service.helper';
import { findCommitment } from './rune-parser.service.helper.findCommitment';
import { Network } from './src/network';
import { Rune } from './src/rune';


describe('Rune parser', () => {

  /*
   * Etch: The process by which a Rune is created.
   *
   * Runes come into existence by being etched.
   * Etching creates a rune and sets its properties.
   * Once set, these properties are immutable, even to its etcher.
   */
  it('should decode a runestone etching that also has a delegate inscription',() => {

    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    const runestone = RuneParserService.parse(txn);

    expect(runestone?.type).toBe(DigitalArtifactType.Runestone);
    expect(runestone?.uniqueId).toBe('Runestone-2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    expect(runestone?.transactionId).toBe('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    expect(runestone?.runestone).not.toBe(null);
    expect(runestone?.cenotaph).toBe(null);

    const etching = runestone?.runestone?.etching;

    // A rune's divisibility is how finely it may be divided into its atomic units.
    // Divisibility is expressed as the number of digits permissible after the decimal point in an amount of runes.
    // A rune with divisibility 0 may not be divided.
    // A unit of a rune with divisibility 1 may be divided into ten sub-units,
    // a rune with divisibility 2 may be divided into a hundred, and so on.
    expect(etching?.divisibility).toBe(2);

    // The etcher of a rune may optionally allocate to themselves units of the rune being etched.
    // This allocation is called a premine.
    expect(etching?.premine).toBe(11000000000n);

    // Names consist of the letters A through Z and are between one and twenty-six letters long.
    expect(etching?.runeName).toBe('Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z');

    // A rune's currency symbol is a single Unicode code point, for example $, ⧉, or 🧿,
    // displayed after quantities of that rune.
    // 101 atomic units of a rune with divisibility 2 and symbol 🧿 would be rendered as 1.01 🧿.
    expect(etching?.symbol).toBe('ᚠ');

    // A rune may have an open mint, allowing anyone to create and allocate units of that rune for themselves.
    // An open mint is subject to terms, which are set upon etching. Pin the full shape:
    // just amount + cap (no height/offset constraints on this etching).
    expect(etching?.terms).toEqual({ amount: 100n, cap: 1111111n });

    // This means this rune will apply all future protocol changes
    expect(etching?.turbo).toBe(true);

    // there is also a tag 13 - we might want to figure out one day what it means
    const inscription = InscriptionParserService.parse(txn)[0];
    expect(inscription.getDelegates()[0]).toBe('e16b8b872584112c6e84c5a941e8ad91f9e428458605a0e9f582305dd12ef247i0');
  });

  /*
   * Edict: A message within a Runestone that allows customization of the output destination and amount of Runes transferred during a transaction.
   * This feature enables crafting custom transactions, such as sending Runes from one address to multiple addresses within a single transaction.
   *
   * A runestone may contain any number of edicts.
   * Edicts consist of a rune ID, an amount, and an output number.
   * Edicts are processed in order, allocating unallocated runes to outputs.
   *
   * This is an transfer of 75 NOR•MOONRUNNERS which has 13 edicts in it
   * https://ordiscan.com/tx/795e09306dba134150142801f92e66dbd44cfad304b0a0688578160a300352ee
   * https://ordpool.space/tx/795e09306dba134150142801f92e66dbd44cfad304b0a0688578160a300352ee
   *
   * 00 - body tag. everything after this is an edict
   * acae33 8103 d836 01 - rune id, amount, output 1
   * 00 00 d836 02 - same rune, same amount, output 2
   * 00 00 d836 03
   * 00 00 d836 04
   * 00 00 d836 05
   * 00 00 8827 06 - same rune, smaller amount, output 6
   * 00 00 8827 07
   * 00 00 8827 08
   * 00 00 8827 09
   * 00 00 8827 0a
   * 00 00 8827 0b
   * 00 00 8827 0c
   * 00 00 8827 0d - same rune, same amount, output 13
   */
  it('should decode a runestone edict',() => {

    const txn = readTransaction('795e09306dba134150142801f92e66dbd44cfad304b0a0688578160a300352ee');
    const runestone = RuneParserService.parse(txn);

    expect(runestone?.type).toBe(DigitalArtifactType.Runestone);
    expect(runestone?.uniqueId).toBe('Runestone-795e09306dba134150142801f92e66dbd44cfad304b0a0688578160a300352ee');
    expect(runestone?.transactionId).toBe('795e09306dba134150142801f92e66dbd44cfad304b0a0688578160a300352ee');
    expect(runestone?.runestone).not.toBe(null);
    expect(runestone?.cenotaph).toBe(null);

    const edicts = runestone?.runestone?.edicts;
    expect(edicts?.length).toBe(13);

    expect(edicts?.[0].amount).toBe(7000n);
    expect(edicts?.[1].amount).toBe(7000n);
    expect(edicts?.[2].amount).toBe(7000n);
    expect(edicts?.[3].amount).toBe(7000n);
    expect(edicts?.[4].amount).toBe(7000n);
    expect(edicts?.[5].amount).toBe(5000n);
    expect(edicts?.[6].amount).toBe(5000n);
    expect(edicts?.[7].amount).toBe(5000n);
    expect(edicts?.[8].amount).toBe(5000n);
    expect(edicts?.[9].amount).toBe(5000n);
    expect(edicts?.[10].amount).toBe(5000n);
    expect(edicts?.[11].amount).toBe(5000n);
    expect(edicts?.[12].amount).toBe(5000n);

    expect(edicts?.[0].output).toBe(1);
    expect(edicts?.[1].output).toBe(2);
    expect(edicts?.[2].output).toBe(3);
    expect(edicts?.[3].output).toBe(4);
    expect(edicts?.[4].output).toBe(5);
    expect(edicts?.[5].output).toBe(6);
    expect(edicts?.[6].output).toBe(7);
    expect(edicts?.[7].output).toBe(8);
    expect(edicts?.[8].output).toBe(9);
    expect(edicts?.[9].output).toBe(10);
    expect(edicts?.[10].output).toBe(11);
    expect(edicts?.[11].output).toBe(12);
    expect(edicts?.[12].output).toBe(13);
  });

  /**
   * An edict with amount zero and output equal to the number of transaction outputs divides all
   * unallocated units of rune id between each non-OP_RETURN output.
   * see https://docs.ordinals.com/runes/specification.html
   */
  it('should decode the dog airdrop',() => {

    const txn = readTransaction('1af2a846befbfac4091bf540adad4fd1a86604c26c004066077d5fe22510e99b');
    const runestone = RuneParserService.parse(txn);

    const edicts = runestone?.runestone?.edicts;
    expect(edicts?.length).toBe(1);

    expect(edicts?.[0].amount).toBe(0n);
    expect(edicts?.[0].output).toBe(2223);
  });

  it('should decode a runestone mint of UNCOMMON•GOODS',() => {

    // this is just a random mint of UNCOMMON•GOODS
    const txn = readTransaction('7f4c516ca5b7b2b747bb04e0bd50aef2e8c4c34d78e681be40c5d93c9d635972');
    const runestone = RuneParserService.parse(txn);

    const mint = runestone?.runestone?.mint;
    expect(mint?.block).toBe(1n);
    expect(mint?.tx).toBe(0);

  });

  it('should decode a runestone mint',() => {

    // this is just a random open mint (THE•PONZI•CHANNEL)
    const txn = readTransaction('e59cc3f24abd61c0b6ec97cbde001e6da859409644c8ed64027512ed5f61329e');
    const runestone = RuneParserService.parse(txn);

    const mint = runestone?.runestone?.mint;
    expect(mint?.block).toBe(849635n);
    expect(mint?.tx).toBe(553);

    expect(runestone?.runestone?.edicts).toBe(undefined);
  });

  it('should decode a runestone mint with edict in the same txn',() => {

    // this is just a random open mint (GRAYSCALE•RUNE)
    const txn = readTransaction('1ec45028e1f3b3ee82644cd6bbaf3f7966d85c8e6fe7c20b829d5c3633333ae6');
    const runestone = RuneParserService.parse(txn);

    const mint = runestone?.runestone?.mint;
    expect(mint?.block).toBe(844127n);
    expect(mint?.tx).toBe(167);

    const edicts = runestone?.runestone?.edicts;
    expect(edicts?.length).toBe(1);
    expect(edicts?.[0].amount).toBe(1n);
    expect(edicts?.[0].id.block).toBe(844127n);
    expect(edicts?.[0].id.tx).toBe(167);
    expect(edicts?.[0].output).toBe(0);
  });

  /*
   * The Pointer field contains the index of the output to which runes unallocated by edicts should be transferred.
   * If the Pointer field is absent, unallocated runes are transferred to the first non-OP_RETURN output.
   */
  it('should decode a runestone pointer',() => {

    const txn = readTransaction('b3205ea418e67fb5a9b80bb14956e7566751903fb7fc6b36af55429af9681d0e');
    const runestone = RuneParserService.parse(txn);

    const pointer = runestone?.runestone?.pointer;
    expect(pointer).toBe(3);
  });

  // https://twitter.com/veryordinally/status/1781987437197050234
  it('should detect the 1st ever cenotaph',() => {

    const txn = readTransaction('25d919c2f02c00ef26a4d674ac1ecffd92684bce35fc449b7834841fd017a9f9');
    const runestone = RuneParserService.parse(txn);

    // it has even two issues, but `"flaw": "truncated-field"` indicates that only the first one is reported by ord
    const cenotaph = runestone?.cenotaph;
    expect(cenotaph?.flaws?.[0]).toBe('truncated_field');
    expect(cenotaph?.flaws?.[1]).toBe('unrecognized_even_tag');
  });

  it('should detect a runestone via hasRunestone', () => {

    // the legendary Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z etching
    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    expect(RuneParserService.hasRunestone(txn)).toBe(true);

    const txn2 = readTransaction('5ba7f995341b9eb70c0cec4f893912f1d853d25d43ade4d3d7739d43bda85a87');
    expect(RuneParserService.hasRunestone(txn2)).toBe(false);
  });

  /**
   * I changed the buffer functions (writeBigUInt64LE + subarray) to Uint8Array,
   * so we have to make sure that everything still works as before
   */
  it('should calculate a commitment from a rune name', () => {

    const cleanedRuneName = removeSpacers('Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z');
    const expectedValue = 67090369340599840949n;

    const testRune = new Rune(expectedValue as any);
    expect(testRune.toString()).toBe(cleanedRuneName)

    const testRune2 = Rune.fromString(cleanedRuneName);
    expect(testRune2.value).toBe(expectedValue);

    const commitment1 = testRune.commitment;
    const commitment2 = testRune2.commitment;

    expect(bytesToHex(commitment1)).toBe('b530368c74df10a303');
    expect(bytesToHex(commitment2)).toBe('b530368c74df10a303');
  });

  it('should find the commitment (using the helpers)', () => {

    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    const runestone = RuneParserService.parse(txn);

    const runeName = runestone?.runestone?.etching?.runeName || ''; // Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z
    const witness = txn.vin[0].witness || [];

    const cleanedRuneName = removeSpacers(runeName); // ZZZZZFEHUZZZZZ
    const commitment = Rune.fromString(cleanedRuneName).commitment;

    const commitmentFound = isStringInArrayOfStrings(bytesToHex(commitment), witness)
    expect(commitmentFound).toBe(true);
  });

  it('should find the commitment (using findCommitment)', () => {

    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    const runestone = RuneParserService.parse(txn);

    const expectedVin = txn.vin[0];
    const foundVin = findCommitment(txn, runestone?.runestone?.etching?.runeName || '');

    expect(expectedVin).toBe(foundVin);
  });

  /*
   * This rune was never etched because the name is too long
   * https://ordinals.com/tx/d60988aec4c37d3a142e263c1f9020adcfd08890f5a0cdd2d694580a4d568af8
   */
  it('should validate the DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG runestone etching that was never accepted by ord', () => {

    const txn = readTransaction('d60988aec4c37d3a142e263c1f9020adcfd08890f5a0cdd2d694580a4d568af8');
    const runestone = RuneParserService.parse(txn);
    const result = RuneParserService.validateRune(txn, [], Network.MAINNET, runestone?.runestone?.etching);

    expect(result).toBe(RuneFlaw.RESERVED_RUNE_NAME);
  });

  /*
   * This rune was never etched because the name was already taken
   *
   * successful etch of RUNES•TO•THE•MOON here: https://ordinals.com/tx/854341c9fdec47dcada9b6abd7f447a81eb9e9c29f2d373d5203e6d04b3d53b4
   * unsuccessful etch of RUNESTOTHEMOON here: https://ordinals.com/tx/1d4a587afd527a6e1bb4b1ef8015830ca6cee312313b5e415184a31626bec752
   */
  it('should validate the RUNESTOTHEMOON runestone etching that was never accepted by ord', () => {

    const txn = readTransaction('1d4a587afd527a6e1bb4b1ef8015830ca6cee312313b5e415184a31626bec752');
    const runestone = RuneParserService.parse(txn);
    const result = RuneParserService.validateRune(txn, [], Network.MAINNET, runestone?.runestone?.etching);

    expect(result).toBe(null);
  });

  /*
   * This rune was never etched because the name is too long
   * This code tests various rules that could prevent a successfull etching
   * https://ordinals.com/tx/d60988aec4c37d3a142e263c1f9020adcfd08890f5a0cdd2d694580a4d568af8
   */
  it('should validate the DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG runestone etching that was never accepted by ord',() => {

    const txn = readTransaction('d60988aec4c37d3a142e263c1f9020adcfd08890f5a0cdd2d694580a4d568af8');
    const runestone = RuneParserService.parse(txn);

    const runeName = runestone?.runestone?.etching?.runeName || ''; // DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG
    const witness = txn.vin[0].witness || [];

    const cleanedRuneName = removeSpacers(runeName); // DOGDOGDOGDOGDOGDOGDOGDOGDOG
    const commitmentHex = bytesToHex(Rune.fromString(cleanedRuneName).commitment); // 64f2e9bd64143833aa0f2e11771a3f15

    // 1. "If a valid commitment is not present, the etching is ignored."
    // --> Everything fine here: It has a commitment!
    const commitmentFound = isStringInArrayOfStrings(commitmentHex, witness);
    expect(commitmentFound).toBe(true);

    // 2. "... present in an input witness tapscript... "
    // --> Everything fine here: The input being spent was a Taproot output.
    const commitTxn = readTransaction('865ed6cd8c02047060d836aefb12fb356b4eeaf403a85c2a0b7b6ba05035c4b4');
    expect(commitTxn.vout[0].scriptpubkey_type).toBe('v1_p2tr');

    // 3. "... where the output being spent has at least six confirmations."
    // -> Everything fine here: the commitment is older than 6 blocks
    expect(txn.vin[0].txid).toBe('865ed6cd8c02047060d836aefb12fb356b4eeaf403a85c2a0b7b6ba05035c4b4');
    const txnHeight = txn.status.block_height || 0; // 840000, of course
    const commitmentHeight = commitTxn.status.block_height || 0; // 839952
    var hasAtLeast6Confirmations = (txnHeight - commitmentHeight) >= 6;
    expect(hasAtLeast6Confirmations).toBe(true);

    // 4. rune name is too large (aka reserved) -- this makes the etching invalid
    const reservedRuneName = isReservedRuneName(cleanedRuneName);
    expect(reservedRuneName).toBe(true);
  });

  /*
   * This rune was never etched because it was too early (block 839_999) but otherwise it's fine
   * https://ordinals.com/tx/86c88168e0b6aab714594312b389d59f7193a55c88e5dfcd60ac6e22246a824f
   *
   *  {
   *    divisibility: 18,
   *    premine: 1000000000000000000000000000n,
   *    runeName: "ZZZZZZZZZZZZZZZZZZZZZZZZZZ",
   *    symbol: "ⓩ",
   *    terms: {
   *      amount: 20000000000000000000000n,
   *      cap: 1000000n,
   *    },
   *    turbo: true,
   */
  it('should validate the ZZZZZZZZZZZZZZZZZZZZZZZZZZ runestone etching that was just too early', () => {

    const txn = readTransaction('86c88168e0b6aab714594312b389d59f7193a55c88e5dfcd60ac6e22246a824f');

    expect(txn.status.block_height).toBe(839_999);
    // we know it's too early, but lets assume it was confirmed in the halving block
    txn.status.block_height = 840_000;

    const runestone = RuneParserService.parse(txn);
    const result = RuneParserService.validateRune(txn, [], Network.MAINNET, runestone?.runestone?.etching);

    expect(result).toBe(null);
  });

  it('should validate the Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z runestone etching that was accepted by ord', () => {

    const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    const txnVin = readTransaction('ec40eb2a00eb3ead495d8f12a95432ec292d4d56839733af3acaa01a94ccb97f');

    const runestone = RuneParserService.parse(txn);
    const result = RuneParserService.validateRune(txn, [txnVin], Network.MAINNET, runestone?.runestone?.etching);

    expect(result).toBe(null);
  });

  /*
   * artifact has no etching and not mint, so the message is empty
   * example: https://ordinals.com/tx/28baf9374797230174803b0c3f63fd39e22bb1972a25cc2af4e791ca8fc89dae
   * it's just a OP_RETURN OP_PUSHNUM_13 OP_PUSHBYTES_1 00, whatever this txn means, it's not a meaningful for us
   */
  it('should ignore empty artifacts', () => {

    const txn = readTransaction('28baf9374797230174803b0c3f63fd39e22bb1972a25cc2af4e791ca8fc89dae');
    const runestone = RuneParserService.parse(txn);
    expect(runestone).toBe(null);
  });
});
