import { readTransaction } from '../../testdata/test.helper';
import { InscriptionParserService } from './inscription-parser.service';

/**
 * ord reads content type, content encoding and metaprotocol with
 * `str::from_utf8(...).ok()` (src/inscriptions/inscription.rs), so bytes that
 * are not valid UTF-8 mean the field does not exist for ord at all. Our
 * decoder is lenient and turns those bytes into replacement characters, which
 * invents a field ord does not have.
 *
 * For content encoding it is not cosmetic: a garbage encoding makes
 * getDecodedContent return its "unknown content encoding" sentinel instead of
 * the actual bytes, while ord, having no encoding, serves the content as is.
 *
 * The transactions below are mainnet inscriptions, and the chain scan found
 * 188 of this shape: 186 with an invalid metaprotocol, one content encoding,
 * one content type.
 */
describe('Inscription parser: fields that are not valid UTF-8', () => {

  it('should report no metaprotocol when its bytes are not valid UTF-8', async () => {

    const txn = readTransaction('4b8306eb3db3b94104797c4532b39b88d513b97d61b5f99c28ba29a0623fc63c');

    const inscription = InscriptionParserService.parse(txn)[0];

    // ord: inscription 126726005, metaprotocol null
    expect(inscription.getMetaprotocol()).toBeUndefined();
    expect(inscription.contentType).toBe('application/json');
    expect(inscription.contentSize).toBe(29);
    expect(await inscription.getContent()).toBe('{"lbl":"Ducat\'s First Vault"}');
  });

  it('should serve the content as is when the content encoding is not valid UTF-8', async () => {

    const txn = readTransaction('f24ca1cdf0f30f78208dd7ae2a2e52383c203c74983f7437733632c20f1ad864');

    const inscription = InscriptionParserService.parse(txn)[0];

    // ord: inscription 116998543, no content encoding, 13 bytes of text
    expect(inscription.getContentEncoding()).toBeUndefined();
    expect(inscription.contentType).toBe('text/plain');
    expect(inscription.contentSize).toBe(13);
    expect(await inscription.getContent()).toBe('932406.bitmap');
  });

  it('should report no content type when its bytes are not valid UTF-8', async () => {

    const txn = readTransaction('4b42f881263d468bdae94445e56ab65d926f8bc392cdf0f51c75b0d97c2e22e9');

    const inscription = InscriptionParserService.parse(txn)[0];

    // ord: inscription 42015613, content_type null, 41 bytes of SNS JSON
    expect(inscription.contentType).toBeUndefined();
    expect(inscription.contentSize).toBe(41);
    expect(await inscription.getContent()).toBe('{"p":"sns","op":"reg","name":"test.sats"}');
  });
});
