/**
 * Transaction-shape detection.
 *
 * The parser is consistently fed transactions in the Esplora API shape
 * (`vin[].witness`, `vin[].scriptsig` lowercase, `vout[].scriptpubkey`
 * lowercase). When a caller accidentally passes the Bitcoin Core RPC
 * verbose shape (`vin[].txinwitness`, `vin[].scriptSig` camelCase as an
 * object, `vout[].scriptPubKey` as an object) every parser silently
 * returns `[]` / `null` because the field names it reads don't exist.
 *
 * The detector here looks for unambiguous bitcoind-rpc-only markers and
 * intentionally biases toward 'esplora' on ambiguity. We only throw when
 * we're certain the input is bitcoind-rpc; anything else (including
 * minimal or unusual inputs) is allowed through so the parser does its
 * normal "is this an artifact? no" work.
 */
export type TxShape = 'esplora' | 'bitcoind-rpc' | 'unknown';

/**
 * Detects the structural shape of a transaction-like object.
 *
 * Returns 'bitcoind-rpc' only on positive evidence: camelCase scriptSig,
 * scriptPubKey-as-object, presence of `txinwitness`, or a coinbase string.
 * Returns 'esplora' on positive Esplora evidence (lowercase scriptsig /
 * scriptpubkey or the `is_coinbase` flag). Returns 'unknown' otherwise —
 * for example for trimmed or test fixtures missing both conventions.
 *
 * The check inspects only the first vin/vout. We don't scan the whole
 * array because the case-difference markers are present on every input
 * in their respective shape; one sample is enough to decide.
 */
export function detectTransactionShape(tx: unknown): TxShape {
  if (!tx || typeof tx !== 'object') {
    return 'unknown';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txObj = tx as any;
  const vin0 = Array.isArray(txObj.vin) ? txObj.vin[0] : undefined;
  const vout0 = Array.isArray(txObj.vout) ? txObj.vout[0] : undefined;

  // Bitcoin Core RPC verbose markers. Any one is sufficient — they only
  // appear in that shape. Coinbase txs in this shape replace scriptSig
  // with a `coinbase: "<hex>"` field, so check that too.
  if (vin0 && typeof vin0 === 'object') {
    if ('scriptSig' in vin0 && typeof vin0.scriptSig === 'object') {
      return 'bitcoind-rpc';
    }
    if (typeof vin0.coinbase === 'string') {
      return 'bitcoind-rpc';
    }
    if ('txinwitness' in vin0) {
      return 'bitcoind-rpc';
    }
  }
  if (vout0 && typeof vout0 === 'object' && typeof vout0.scriptPubKey === 'object') {
    return 'bitcoind-rpc';
  }

  // Esplora markers. `is_coinbase` is unique to Esplora's shape;
  // lowercase `scriptsig` / `scriptpubkey` are present on every input /
  // output in that shape.
  if (vin0 && typeof vin0 === 'object') {
    if (vin0.is_coinbase === true) {
      return 'esplora';
    }
    if (typeof vin0.scriptsig === 'string') {
      return 'esplora';
    }
  }
  if (vout0 && typeof vout0 === 'object' && typeof vout0.scriptpubkey === 'string') {
    return 'esplora';
  }

  return 'unknown';
}

/**
 * Throws a developer-facing Error when the transaction is unambiguously
 * the Bitcoin Core RPC verbose shape. Returns silently for 'esplora' and
 * 'unknown' — the latter on purpose, so trimmed test fixtures and
 * minimal mempool entries pass through to the parser as before.
 *
 * The error message names the offending fields and the conventional
 * conversion path so the developer can find their bug fast: pass
 * `skipConversion=false` to `bitcoinApi.$getRawTransaction()`, or run
 * raw RPC blocks through `convertVerboseBlockToSimplePlus()`.
 */
export function assertEsploraShape(tx: unknown, callerName = 'parser'): void {
  if (detectTransactionShape(tx) === 'bitcoind-rpc') {
    throw new Error(
      `${callerName}: received Bitcoin Core RPC verbose tx shape ` +
      `(vin[].txinwitness / scriptSig object / vout[].scriptPubKey object), ` +
      `expected the Esplora shape (vin[].witness / scriptsig string / ` +
      `vout[].scriptpubkey string). Convert via your bitcoin-api's ` +
      `$convertTransaction() — i.e. call $getRawTransaction(txId, ` +
      `skipConversion=false, ...) — or for raw RPC blocks use ` +
      `convertVerboseBlockToSimplePlus() before parsing.`,
    );
  }
}
