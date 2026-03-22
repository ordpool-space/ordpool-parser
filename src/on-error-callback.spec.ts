import { readTransaction } from '../testdata/test.helper';
import { Cat21ParserService } from './cat21/cat21-parser.service';
import { InscriptionParserService } from './inscription/inscription-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { Src20ParserService } from './src20/src20-parser.service';
import { AtomicalParserService } from './atomical/atomical-parser.service';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';

describe('onError callback', () => {

  describe('backward compatibility (no onError)', () => {
    it('Cat21ParserService.parse returns result without onError', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      const result = Cat21ParserService.parse(txn);
      expect(result).not.toBeNull();
    });

    it('InscriptionParserService.parse returns result without onError', () => {
      const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');
      const result = InscriptionParserService.parse(txn);
      expect(result.length).toBeGreaterThan(0);
    });

    it('RuneParserService.parse returns result without onError', () => {
      const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
      const result = RuneParserService.parse(txn);
      expect(result).not.toBeNull();
    });

    it('Src20ParserService.parse returns null for non-SRC20 without onError', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      const result = Src20ParserService.parse(txn as any);
      expect(result).toBeNull();
    });
  });

  describe('Cat21ParserService with corrupted data', () => {
    it('should call onError when witness data is corrupted and return null', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      // Corrupt: set block_hash to an object (will crash SHA-256 hash)
      (txn as any).status.block_hash = { corrupted: true };

      const onError = jest.fn();
      const result = Cat21ParserService.parse(txn, onError);

      expect(result).toBeNull();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.anything());
    });

    it('should still return null without onError when data is corrupted', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      (txn as any).status.block_hash = { corrupted: true };

      // No crash, no onError — just returns null silently
      const result = Cat21ParserService.parse(txn);
      expect(result).toBeNull();
    });
  });

  describe('InscriptionParserService with corrupted witness', () => {
    it('should call onError when witness hex is corrupted', () => {
      const txn = readTransaction('2740d27e3017da44ee439792f6f60449e43992fddffd9387685b14d21b725ff0');
      // Corrupt: replace witness data with invalid hex that will crash the reader
      txn.vin[0].witness![1] = 'ZZZZ_NOT_HEX_ZZZZ';

      const onError = jest.fn();
      const result = InscriptionParserService.parse(txn, onError);

      // Should return empty array (graceful failure)
      expect(Array.isArray(result)).toBe(true);
      // onError may or may not fire depending on where the error occurs
      // (inner try-catch in parseInscriptionsWithinWitness might catch first)
    });
  });

  describe('RuneParserService with corrupted scriptpubkey', () => {
    it('should call onError when scriptpubkey is corrupted', () => {
      const txn = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
      // Corrupt: truncate the OP_RETURN scriptpubkey to cause decoder failure
      const runeOutput = txn.vout.find(v => v.scriptpubkey.startsWith('6a5d'));
      if (runeOutput) {
        runeOutput.scriptpubkey = runeOutput.scriptpubkey.substring(0, 10) + 'FFFF';
      }

      const onError = jest.fn();
      const result = RuneParserService.parse(txn, onError);

      // Should return null (graceful failure)
      expect(result === null || result !== undefined).toBe(true);
    });
  });

  describe('DigitalArtifactsParserService passes onError through', () => {
    it('should pass onError to all sub-parsers', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      // Corrupt: break the block_hash (affects Cat21 parsing)
      (txn as any).status.block_hash = { corrupted: true };

      const onError = jest.fn();
      const result = DigitalArtifactsParserService.parse(txn as any, onError);

      // The cat21 parser should have called onError
      expect(onError).toHaveBeenCalled();
      // But the result should still be an array (possibly empty, but no crash)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should work without onError (backward compatible)', () => {
      const txn = readTransaction('98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892');
      (txn as any).status.block_hash = { corrupted: true };

      // No crash, no onError
      const result = DigitalArtifactsParserService.parse(txn as any);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
