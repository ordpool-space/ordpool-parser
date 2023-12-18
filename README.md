# ordpool-parser

The parsing engine that detects inscriptions in Bitcoin transactions.
The compiled code has zero dependencies and works in the Browser and in Node.js out of the box.

The latest version of this script is used by https://ordpool.space


## 🚀 Usage

This package has zero dependencies and should "just work". First, install it:

```
npm install ordpool-parser
```

Then, you can use the parser in your project. 
It expects a transaction from the Mempool API:

```ts
import axios from 'axios';
import { InscriptionParserService } from 'ordpool-parser';

async function getInscriptions(txId: string) {

  const response = await axios.get(`https://mempool.space/api/tx/${txId}`);
  const transaction = response.data;

  return InscriptionParserService.parseInscriptions(transaction);
}

const parsedInscriptions = await getInscriptions('f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f');

if (!parsedInscriptions.length) {
  console.log('No inscriptions found!');
} else {
  // Output: text/html;charset=utf-8
  console.log(parsedInscriptions[0].contentType);

  // UTF-8 encoded string (not intended for binary content like images or videos)
  // Output: <html><!--cubes.haushoppe.art--><body> [...]
  console.log(parsedInscriptions[0].getContentString());

  // Base64 encoded data URI that can be displayed in an iframe
  // Output: data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT4 [...]
  console.log(parsedInscriptions[0].getDataUri());
}

```

This example uses `axios`, a popular HTTP client for both browser and Node.js environments. 
You can install it via `npm install axios`. Of course, any other compatible HTTP client will also work.

**Note:** This is a simplified example! Make sure to handle errors when making HTTP requests, as network issues can occur.


## 🧡 Contribute

### Prerequisites

Node.js (Version 20 or later) to test & compile the TypeScript code to JavaScript.

### Install

First, install Node.js version 20. 
Then, install the NPM dependencies and execute the tests with the following commands:

```bash
npm install
npm test
```

### How to add a feature

Every feature must be tested in the browser and in the node environment! 
Use a mainnet transaction to create a test scenario. 
The goal of this parser is to parse byte-perfect inscriptions that are identical to [ord](https://github.com/ordinals/ord).

1. **Fetch Transaction Test Data**: Save the raw transaction JSON to the `testdata` folder.
    ```bash
    npm run fetch-tx-testdata
    ```
    Enter the `transactionId` (e.g.`78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251`) and check the results.

2. **Fetch Inscription Test Data**: Save the reference inscription as a file in the `testdata` folder.

    ```bash
    npm run fetch-inscription-testdata
    ```
    Enter the `inscriptionId`, which is the `transactionId` + `i` + the `index` (e.g.`78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251i0`), and check the results!

3. **Contribute:** Add your new feature, include meaningful tests, and submit a pull request if all tests pass.

4. **Hint:** Debug the unit tests using VS Code. The `launch.json` file is already prepared for this purpose.

### Build

To build a version without the tests:

```bash
npm run build
```

To publish a new version to NPM:

```bash
npm run publish
```

## 📙 Learn More

- Ordpool: https://ordpool.space
- What is an Inscription "envelope"?: https://blog.ordinalhub.com/what-is-an-envelope/
- The Cursed Inscriptions Rabbithole: https://youtu.be/cpAh5_KhvMg
