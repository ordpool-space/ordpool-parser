# ordpool-parser

The parsing engine that detects inscriptions in Bitcoin transactions.
The compiled code has zero dependencies and works in the Browser and in Node.js out of the box.

The latest version of this script is used by https://ordpool.space

## Prerequisites

Node.js (Version 20 or later) to test & compile the TypeScript code to JavaScript.

## Contribute

First, install Node.js version 20. 
Then, install the NPM dependencies and execute the tests with the following commands:

```bash
npm install
npm test
```

Every feature must be tested in the browser and in the node environment! 
Use a mainnet transaction to create a test scenario. 
The goal of this parser is to parse byte-perfect inscriptions that are identical to [ord](https://github.com/ordinals/ord).

Steps:

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

**Hint:** Debug the unit tests using VS Code. The `launch.json` file is already prepared for this purpose.

## Build

To build a version without the tests:

```bash
npm run build
```

To publish a new version to NPM:

```bash
npm run publish
```

## Learn More

- What is an Inscription "envelope"?: https://blog.ordinalhub.com/what-is-an-envelope/
- The Cursed Inscriptions Rabbithole: https://youtu.be/cpAh5_KhvMg
