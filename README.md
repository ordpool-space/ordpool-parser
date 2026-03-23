# ordpool-parser

Zero-dependency TypeScript parser for Bitcoin digital artifacts. Detects and extracts **Inscriptions**, **Runes**, **BRC-20**, **SRC-20 Stamps**, **CAT-21**, **Atomicals**, and **Labitbu** from raw transaction data.

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

## Contribute

### Prerequisites

Node.js (version 20 or later).

### Install & test

```bash
npm install
npm test
```

### How to add a feature

Every feature must be tested in the browser and in the node environment!
Use a mainnet transaction to create a test scenario.

1. **Fetch transaction test data:**
    ```bash
    npm run fetch-tx-testdata
    ```

2. **Fetch inscription reference file** (for byte-for-byte comparison):
    ```bash
    npm run fetch-inscription-testdata
    ```

3. Add your feature, include meaningful tests with real blockchain data, and submit a pull request.

4. **Hint:** Debug the unit tests using VS Code. The `launch.json` file is already prepared.

## License

MIT
