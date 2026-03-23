# ordpool-parser

Yes, Bitcoin is money. Everything else is an attack on Bitcoin. We get it. [BIP 110](https://github.com/bitcoin/bips/blob/master/bip-0110.mediawiki) will fix this.

But you still want to know what's inside your blocks, don't you? Know your enemy! ;-)

**ordpool-parser** is a zero-dependency TypeScript parser that detects and extracts digital artifacts from raw Bitcoin transactions: **Inscriptions**, **Runes**, **BRC-20**, **SRC-20 Stamps**, **CAT-21**, **Atomicals**, and **Labitbu**.

Works in **Node.js** and **browsers** out of the box. Used by [ordpool.space](https://ordpool.space).

```
npm install ordpool-parser
```

## What does it parse?

| Protocol | What it detects | Key data extracted |
|----------|----------------|-------------------|
| **Inscriptions** | `OP_FALSE OP_IF "ord"` envelope in witness | Content, content type, metadata, parents, delegates, **galleries** (tag 17 properties with items + traits) |
| **Runes** | `OP_RETURN` runestone | Etching, mint, transfers, cenotaphs |
| **BRC-20** | JSON inscriptions with `"p": "brc-20"` | Deploy, mint, transfer operations |
| **SRC-20** | RC4-encrypted stamp data in multisig outputs | Deploy, mint, transfer operations |
| **CAT-21** | Transactions with `nLockTime == 21` | Deterministic cat image (SVG) + traits |
| **Atomicals** | `OP_FALSE OP_IF "atom"` envelope in witness | Operation type, CBOR payload, args, file attachments |
| **Labitbu** | WebP image in Taproot control block (NUMS key) | 4096-byte WebP image |

## Quick start

The parser expects transactions in Esplora API JSON format (used by mempool.space and blockstream.info).

### Parse everything at once

```ts
import { DigitalArtifactsParserService } from 'ordpool-parser';

const response = await fetch(`https://mempool.space/api/tx/${txId}`);
const tx = await response.json();

// Returns all digital artifacts found in the transaction
const artifacts = DigitalArtifactsParserService.parse(tx);
```

### Parse specific types

```ts
import {
  InscriptionParserService,
  Cat21ParserService,
  RuneParserService,
  AtomicalParserService,
  LabitbuParserService,
  Src20ParserService,
} from 'ordpool-parser';

// Inscriptions (can return multiple — batch inscriptions)
const inscriptions = InscriptionParserService.parse(tx);
if (inscriptions.length) {
  console.log(inscriptions[0].contentType);
  console.log(await inscriptions[0].getContent());

  // Galleries (tag 17 properties)
  const properties = await inscriptions[0].getProperties();
  if (properties) {
    console.log(properties.gallery);  // Array of { inscriptionId, title?, traits? }
  }
}

// CAT-21
const cat = Cat21ParserService.parse(tx);
if (cat) {
  console.log(cat.getImage());   // SVG string
  console.log(cat.getTraits());  // { genesis, gender, designIndex, ... }
}

// Runes
const rune = RuneParserService.parse(tx);
if (rune?.runestone?.etching) {
  console.log(rune.runestone.etching.runeName);
}

// Atomicals
const atomical = AtomicalParserService.parse(tx);
if (atomical) {
  console.log(atomical.operation);   // 'nft', 'dft', 'ft', 'mod', ...
  console.log(atomical.getArgs());   // { request_ticker, mint_amount, ... }
  console.log(atomical.getFiles()); // [{ name, contentType, data }]
}

// Labitbu
const labitbu = LabitbuParserService.parse(tx);
if (labitbu) {
  console.log(labitbu.getDataRaw()); // 4096-byte WebP image
}
```

### Analyze a full block

```ts
import { DigitalArtifactAnalyserService } from 'ordpool-parser';

// Analyze all transactions in a block — returns per-type counts, fees, mint activity
const stats = await DigitalArtifactAnalyserService.analyseTransactions(blockTxns);
```

## License

MIT
