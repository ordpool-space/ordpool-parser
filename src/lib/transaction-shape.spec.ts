import { readTransaction } from '../../testdata/test.helper';
import { assertEsploraShape, detectTransactionShape } from './transaction-shape';

describe('detectTransactionShape', () => {

  it('returns "esplora" for a real Esplora-shaped transaction', () => {
    // Real mainnet inscription tx (image/png) pulled via the Esplora
    // API. Used elsewhere in the parser test suite as a happy-path
    // fixture.
    const tx = readTransaction('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc');
    expect(detectTransactionShape(tx)).toBe('esplora');
  });

  it('returns "bitcoind-rpc" when scriptSig is the camelCase object form', () => {
    const rpcTx = {
      vin: [{ scriptSig: { asm: '', hex: '' }, sequence: 0 }],
      vout: [],
    };
    expect(detectTransactionShape(rpcTx)).toBe('bitcoind-rpc');
  });

  it('returns "bitcoind-rpc" when txinwitness is present', () => {
    // A real-world hit: vin[0] is non-segwit (no scriptSig.hex) but a
    // later input is taproot. The witness-name check still wins.
    const rpcTx = {
      vin: [{ txinwitness: ['deadbeef'], sequence: 0 }],
      vout: [],
    };
    expect(detectTransactionShape(rpcTx)).toBe('bitcoind-rpc');
  });

  it('returns "bitcoind-rpc" for a coinbase transaction in RPC shape', () => {
    const rpcCoinbase = {
      vin: [{ coinbase: '03abcdef', sequence: 0 }],
      vout: [{ value: 6.25, n: 0, scriptPubKey: { asm: '', hex: '', type: 'pubkey' } }],
    };
    expect(detectTransactionShape(rpcCoinbase)).toBe('bitcoind-rpc');
  });

  it('returns "bitcoind-rpc" when only vout discriminator is present', () => {
    // Defensive: minimal vin, but a clearly-RPC vout discriminates.
    const rpcTx = {
      vin: [{}],
      vout: [{ value: 1.0, n: 0, scriptPubKey: { hex: '00' } }],
    };
    expect(detectTransactionShape(rpcTx)).toBe('bitcoind-rpc');
  });

  it('returns "esplora" for a coinbase transaction with is_coinbase flag', () => {
    const esploraCoinbase = {
      vin: [{ is_coinbase: true, scriptsig: 'aabb', witness: ['cc'] }],
      vout: [{ scriptpubkey: '6a', value: 312500000 }],
    };
    expect(detectTransactionShape(esploraCoinbase)).toBe('esplora');
  });

  it('returns "esplora" for a minimal Esplora-shape input even without witness data', () => {
    // Legacy P2PKH input — no witness array present, but lowercase
    // scriptsig is enough to mark it as Esplora.
    const legacyTx = {
      vin: [{ scriptsig: '47304402...', sequence: 0xffffffff }],
      vout: [{ scriptpubkey: '76a914...88ac', value: 100000 }],
    };
    expect(detectTransactionShape(legacyTx)).toBe('esplora');
  });

  it('returns "unknown" for null / non-object inputs', () => {
    expect(detectTransactionShape(null)).toBe('unknown');
    expect(detectTransactionShape(undefined)).toBe('unknown');
    expect(detectTransactionShape('foo')).toBe('unknown');
    expect(detectTransactionShape(42)).toBe('unknown');
  });

  it('returns "unknown" for an object with no vin / vout arrays', () => {
    expect(detectTransactionShape({})).toBe('unknown');
    expect(detectTransactionShape({ vin: 'oops' })).toBe('unknown');
  });

  it('returns "unknown" for a vin entry that has neither shape\'s markers', () => {
    // Hypothetical trimmed fixture — we deliberately pass it through
    // rather than guess. The biased-to-Esplora rule is implemented at
    // assertEsploraShape, not here, so 'unknown' is the honest answer.
    const trimmed = { vin: [{ txid: 'aa' }], vout: [{ value: 1 }] };
    expect(detectTransactionShape(trimmed)).toBe('unknown');
  });
});


describe('assertEsploraShape', () => {

  it('throws on a clearly bitcoind-rpc shape', () => {
    const rpcTx = { vin: [{ scriptSig: { asm: '', hex: '' } }], vout: [] };
    expect(() => assertEsploraShape(rpcTx, 'TestParser.parse'))
      .toThrow(/TestParser\.parse: received Bitcoin Core RPC verbose tx shape/);
  });

  it('does not throw on Esplora shape', () => {
    const tx = readTransaction('092111e882a8025f3f05ab791982e8cc7fd7395afe849a5949fd56255b5c41cc');
    expect(() => assertEsploraShape(tx)).not.toThrow();
  });

  it('does not throw on "unknown" — bias toward Esplora on uncertainty', () => {
    expect(() => assertEsploraShape({})).not.toThrow();
    expect(() => assertEsploraShape({ vin: [{ txid: 'aa' }], vout: [{ value: 1 }] })).not.toThrow();
    expect(() => assertEsploraShape(null)).not.toThrow();
  });
});
