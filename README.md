# ordpool-parser

The parsing engine that detects inscriptions in Bitcoin transactions.
The transpiled code has zero dependencies and works in the Browser out of the box. 

The latest version of this script is used by https://ordpool.space


## Install

Install and execute the tests like this:

```bash
npm install
npm test
```

Every feature is required to be tested!
Use a mainnet transaction to create a test-scenario. The goal of this parser is to parse byte-perfect inscriptions.
Ord is always right!

Steps:

1. Save the raw transaction JSON to the folder `testdata` by running the following script.

   ```bash
   npm run fetch-tx-testdata
   ```

   Enter the `transactionId` (eg.`78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251`) and check the results!

2. Save the reference inscription as a file to the `testdata` folder:

   ```bash
   npm run fetch-inscription-testdata
   ```

  Enter the `inscriptionId`, which is the `transactionId` + `i` + the `index` (eg.`78fa9d6e9b2b49fbb9f4838e1792dba7c1ec836f22e3206561e2d52759708251i0`) and check the results!


----

Read more here:
- What is an Inscription "envelope"?: https://blog.ordinalhub.com/what-is-an-envelope/
- The Cursed Inscriptions Rabbithole: https://youtu.be/cpAh5_KhvMg
