import { createCatHash, sha256Hash } from "./cat21-parser.service.helper";
import { bytesToHex } from "./lib/conversions";

// verified against https://emn178.github.io/online-tools/sha256.html
// UTF-8 In: Hello, world!
// Hex Out: 315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3
describe('sha256Hash', () => {
  it('should correctly hash a Uint8Array', () => {

    const input = new TextEncoder().encode('Hello, world!');
    const hashed = sha256Hash(input);

    expect(hashed).toBeInstanceOf(Uint8Array);
    expect(hashed.length).toBe(32); // SHA-256 hash is always 32 bytes long

    const hex = bytesToHex(hashed);
    expect(hex.length).toBe(64); // this is now 64 characters long
    expect(hex).toBe('315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3');
  });
});

// verified against https://emn178.github.io/online-tools/sha256.html
// Hex In: 98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7
// Hex Result: 4f988e3ec77978db7774182d573ef8b077972d00b664a7095b121152c86a2f58
describe('createCat21Hash', () => {
  it('should create a valid CAT-21 hash for a given transactionId and blockId', () => {
    const transactionId = '98316dcb21daaa221865208fe0323616ee6dd84e6020b78bc6908e914ac03892';
    const blockId = '000000000000000000018e3ea447b11385e3330348010e1b2418d0d8ae4e0ac7';

    const catHash = createCatHash(transactionId, blockId);
    expect(catHash.length).toBe(64);

    // the catHash of the Genesis cat
    expect(catHash).toBe('4f988e3ec77978db7774182d573ef8b077972d00b664a7095b121152c86a2f58');
  });
});
