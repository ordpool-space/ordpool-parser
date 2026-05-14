import { getSrc101Flaws, parseSrc101Content, Src101Mint, Src101Parsed } from './parsed-src101';

describe('parseSrc101Content', () => {

  it('should parse a valid deploy', () => {
    // Real on-chain shape from BitNameService (block 871,022, tx 5d18994d...)
    const result = parseSrc101Content(
      '{"p":"src-101","op":"deploy","root":"btc","name":"BitNameService","lim":"10","desc":"Bitname Service powered by BTC stamp."}'
    );
    expect(result).toEqual({
      p: 'src-101',
      op: 'deploy',
      root: 'btc',
      name: 'BitNameService',
      lim: '10',
      desc: 'Bitname Service powered by BTC stamp.',
    });
  });

  it('should parse a valid mint', () => {
    const result = parseSrc101Content(
      '{"p":"src-101","op":"mint","hash":"abc123","tokenid":["dGVzdA=="],"tokenid_utf8":["test"],"coef":100,"dua":1}'
    );
    expect(result?.op).toBe('mint');
  });

  it('should accept transfer / renew / setrecord ops', () => {
    expect(parseSrc101Content('{"p":"src-101","op":"transfer","hash":"h","tokenid":["t"]}')?.op).toBe('transfer');
    expect(parseSrc101Content('{"p":"src-101","op":"renew","hash":"h","tokenid":["t"],"dua":1}')?.op).toBe('renew');
    expect(parseSrc101Content('{"p":"src-101","op":"setrecord","hash":"h","tokenid":["t"]}')?.op).toBe('setrecord');
  });

  it('should return null for non-string input', () => {
    expect(parseSrc101Content(null as any)).toBeNull();
    expect(parseSrc101Content(undefined as any)).toBeNull();
    expect(parseSrc101Content('')).toBeNull();
  });

  it('should return null when p is not src-101', () => {
    expect(parseSrc101Content('{"p":"src-20","op":"deploy"}')).toBeNull();
    expect(parseSrc101Content('{"p":"other","op":"deploy"}')).toBeNull();
  });

  it('should return null for unknown operation', () => {
    expect(parseSrc101Content('{"p":"src-101","op":"burn"}')).toBeNull();
    expect(parseSrc101Content('{"p":"src-101","op":"random"}')).toBeNull();
  });
});


describe('getSrc101Flaws', () => {

  // -- Valid cases --

  it('should return no flaws for a valid deploy with name + root', () => {
    const deploy: Src101Parsed = { p: 'src-101', op: 'deploy', name: 'BitNameService', root: 'btc' };
    expect(getSrc101Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid mint', () => {
    const mint: Src101Parsed = {
      p: 'src-101',
      op: 'mint',
      hash: 'abc123',
      tokenid: ['dGVzdA=='],
      coef: 100,
      dua: 1,
    };
    expect(getSrc101Flaws(mint)).toEqual([]);
  });

  it('should return no flaws for a valid transfer', () => {
    const transfer: Src101Parsed = {
      p: 'src-101',
      op: 'transfer',
      hash: 'abc123',
      tokenid: ['dGVzdA=='],
      destination: 'bc1q...',
    };
    expect(getSrc101Flaws(transfer)).toEqual([]);
  });

  it('should return no flaws for a valid renew', () => {
    const renew: Src101Parsed = {
      p: 'src-101',
      op: 'renew',
      hash: 'abc123',
      tokenid: ['dGVzdA=='],
      dua: 1,
    };
    expect(getSrc101Flaws(renew)).toEqual([]);
  });

  // -- missing_name (deploy only) --

  it('should detect deploy without name', () => {
    const deploy = { p: 'src-101', op: 'deploy', root: 'btc' } as Src101Parsed;
    expect(getSrc101Flaws(deploy)).toContain('missing_name');
  });

  it('should detect deploy with empty name', () => {
    const deploy = { p: 'src-101', op: 'deploy', name: '  ', root: 'btc' } as Src101Parsed;
    expect(getSrc101Flaws(deploy)).toContain('missing_name');
  });

  // -- missing_root (deploy only) --

  it('should detect deploy without root', () => {
    const deploy = { p: 'src-101', op: 'deploy', name: 'Test' } as Src101Parsed;
    expect(getSrc101Flaws(deploy)).toContain('missing_root');
  });

  // -- missing_hash (non-deploy ops) --

  it('should detect mint without hash', () => {
    const mint = { p: 'src-101', op: 'mint', tokenid: ['t'] } as Src101Mint;
    expect(getSrc101Flaws(mint)).toContain('missing_hash');
  });

  it('should detect transfer without hash', () => {
    const transfer = { p: 'src-101', op: 'transfer', tokenid: ['t'] } as Src101Parsed;
    expect(getSrc101Flaws(transfer)).toContain('missing_hash');
  });

  // -- missing_tokenid (non-deploy ops) --

  it('should detect mint without tokenid', () => {
    const mint = { p: 'src-101', op: 'mint', hash: 'abc' } as Src101Mint;
    expect(getSrc101Flaws(mint)).toContain('missing_tokenid');
  });

  it('should detect mint with empty tokenid array', () => {
    const mint = { p: 'src-101', op: 'mint', hash: 'abc', tokenid: [] } as Src101Mint;
    expect(getSrc101Flaws(mint)).toContain('missing_tokenid');
  });

  it('should detect mint with non-array tokenid', () => {
    const mint = { p: 'src-101', op: 'mint', hash: 'abc', tokenid: 'not-an-array' } as unknown as Src101Mint;
    expect(getSrc101Flaws(mint)).toContain('missing_tokenid');
  });

  // -- Multiple flaws --

  it('should detect multiple flaws on a malformed deploy', () => {
    const deploy = { p: 'src-101', op: 'deploy' } as Src101Parsed;
    const flaws = getSrc101Flaws(deploy);
    expect(flaws).toContain('missing_name');
    expect(flaws).toContain('missing_root');
  });

  it('should detect multiple flaws on a malformed mint', () => {
    const mint = { p: 'src-101', op: 'mint' } as Src101Mint;
    const flaws = getSrc101Flaws(mint);
    expect(flaws).toContain('missing_hash');
    expect(flaws).toContain('missing_tokenid');
  });
});
