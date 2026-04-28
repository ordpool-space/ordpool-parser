import { getSrc20Flaws, parseSrc20Content, Src20Deploy, Src20Mint, Src20Parsed, Src20Transfer } from './parsed-src20';

describe('parseSrc20Content', () => {

  it('should parse a valid deploy', () => {
    const result = parseSrc20Content('{"p":"src-20","op":"deploy","tick":"STAMP","max":"21000","lim":"100","dec":"8"}');
    expect(result).toEqual({ p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '8' });
  });

  it('should parse a valid mint', () => {
    const result = parseSrc20Content('{"p":"src-20","op":"mint","tick":"STAMP","amt":"100"}');
    expect(result).toEqual({ p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' });
  });

  it('should parse a valid transfer', () => {
    const result = parseSrc20Content('{"p":"src-20","op":"transfer","tick":"STAMP","amt":"50"}');
    expect(result).toEqual({ p: 'src-20', op: 'transfer', tick: 'STAMP', amt: '50' });
  });

  it('should return null for non-string input', () => {
    expect(parseSrc20Content(null as any)).toBeNull();
    expect(parseSrc20Content(undefined as any)).toBeNull();
    expect(parseSrc20Content(123 as any)).toBeNull();
    expect(parseSrc20Content('')).toBeNull();
  });

  it('should return null for non-JSON content', () => {
    expect(parseSrc20Content('not json')).toBeNull();
    expect(parseSrc20Content('[1,2,3]')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseSrc20Content('{broken')).toBeNull();
  });

  it('should return null when p is not src-20', () => {
    expect(parseSrc20Content('{"p":"brc-20","op":"deploy","tick":"TEST","max":"1000"}')).toBeNull();
    expect(parseSrc20Content('{"p":"other","op":"deploy"}')).toBeNull();
  });

  it('should return null for unknown operation', () => {
    expect(parseSrc20Content('{"p":"src-20","op":"burn","tick":"STAMP"}')).toBeNull();
    expect(parseSrc20Content('{"p":"src-20","op":"unknown"}')).toBeNull();
  });

  it('should trim whitespace before parsing', () => {
    const result = parseSrc20Content('  {"p":"src-20","op":"mint","tick":"STAMP","amt":"100"}  ');
    expect(result).toEqual({ p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' });
  });

  it('should accept extra fields (ignored per SRC-20 spec)', () => {
    const result = parseSrc20Content('{"p":"src-20","op":"deploy","tick":"STAMP","max":"21000","lim":"100","random":"test"}');
    // Extra "random" field is preserved (we don't strip unknown fields)
    expect(result).toEqual({
      p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', random: 'test',
    });
  });
});


describe('getSrc20Flaws', () => {

  // -- Valid cases (no flaws) --

  it('should return no flaws for a valid deploy', () => {
    const deploy: Src20Parsed = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '8' };
    expect(getSrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid deploy without optional dec', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100' } as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid deploy with dec=0', () => {
    const deploy: Src20Parsed = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '0' };
    expect(getSrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid mint', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' };
    expect(getSrc20Flaws(mint)).toEqual([]);
  });

  it('should return no flaws for a valid transfer', () => {
    const transfer: Src20Parsed = { p: 'src-20', op: 'transfer', tick: 'STAMP', amt: '50' };
    expect(getSrc20Flaws(transfer)).toEqual([]);
  });

  it('should accept single-character tickers', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: 'X', amt: '100' };
    expect(getSrc20Flaws(mint)).toEqual([]);
  });

  it('should accept 5-character tickers (SRC-20 allows 1-5 chars)', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' };
    expect(getSrc20Flaws(mint)).toEqual([]);
  });

  it('should accept tickers up to 20 characters (DB column limit)', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: '12345678901234567890', amt: '100' };
    expect(getSrc20Flaws(mint)).toEqual([]);
  });


  // -- missing_ticker --

  it('should detect missing ticker (undefined)', () => {
    const deploy = { p: 'src-20', op: 'deploy', max: '1000', lim: '100' } as unknown as Src20Parsed;
    expect(getSrc20Flaws(deploy)).toContain('missing_ticker');
  });

  it('should detect missing ticker (null)', () => {
    const mint = { p: 'src-20', op: 'mint', tick: null, amt: '100' } as unknown as Src20Parsed;
    expect(getSrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (empty string)', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: '', amt: '100' };
    expect(getSrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (whitespace only)', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: '   ', amt: '100' };
    expect(getSrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (not a string)', () => {
    const mint = { p: 'src-20', op: 'mint', tick: 123, amt: '100' } as unknown as Src20Parsed;
    expect(getSrc20Flaws(mint)).toContain('missing_ticker');
  });


  // -- ticker_too_long --

  it('should detect ticker exceeding 20 characters', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: '123456789012345678901', amt: '100' };
    expect(getSrc20Flaws(mint)).toContain('ticker_too_long');
    expect(getSrc20Flaws(mint)).not.toContain('missing_ticker');
  });


  // -- missing_max_supply (deploy only) --

  it('should detect missing max supply (undefined)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', lim: '100' } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (null)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: null, lim: '100' } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (empty string)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '', lim: '100', dec: '8' };
    expect(getSrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (whitespace only)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '  ', lim: '100', dec: '8' };
    expect(getSrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (not a string)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: 21000, lim: '100' } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should NOT check max supply for mint operations', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' };
    expect(getSrc20Flaws(mint)).not.toContain('missing_max_supply');
  });


  // -- missing_mint_limit (deploy only, required for SRC-20 unlike BRC-20) --

  it('should detect missing mint limit (undefined)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000' } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_mint_limit');
  });

  it('should detect missing mint limit (null)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: null } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_mint_limit');
  });

  it('should detect missing mint limit (empty string)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '', dec: '8' };
    expect(getSrc20Flaws(deploy)).toContain('missing_mint_limit');
  });

  it('should detect missing mint limit (whitespace only)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '  ', dec: '8' };
    expect(getSrc20Flaws(deploy)).toContain('missing_mint_limit');
  });

  it('should detect missing mint limit (not a string)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: 100 } as unknown as Src20Deploy;
    expect(getSrc20Flaws(deploy)).toContain('missing_mint_limit');
  });

  it('should NOT check mint limit for mint operations', () => {
    const mint: Src20Parsed = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' };
    expect(getSrc20Flaws(mint)).not.toContain('missing_mint_limit');
  });


  // -- missing_amount (mint/transfer only) --

  it('should detect missing amount on mint (undefined)', () => {
    const mint = { p: 'src-20', op: 'mint', tick: 'STAMP' } as unknown as Src20Parsed;
    expect(getSrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on mint (null)', () => {
    const mint = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: null } as unknown as Src20Parsed;
    expect(getSrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on mint (empty string)', () => {
    const mint: Src20Mint = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: '' };
    expect(getSrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on transfer (undefined)', () => {
    const transfer = { p: 'src-20', op: 'transfer', tick: 'STAMP' } as unknown as Src20Parsed;
    expect(getSrc20Flaws(transfer)).toContain('missing_amount');
  });

  it('should detect missing amount on transfer (whitespace only)', () => {
    const transfer: Src20Transfer = { p: 'src-20', op: 'transfer', tick: 'STAMP', amt: '  ' };
    expect(getSrc20Flaws(transfer)).toContain('missing_amount');
  });

  it('should detect missing amount (not a string)', () => {
    const mint = { p: 'src-20', op: 'mint', tick: 'STAMP', amt: 100 } as unknown as Src20Parsed;
    expect(getSrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should NOT check amount for deploy operations', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '8' };
    expect(getSrc20Flaws(deploy)).not.toContain('missing_amount');
  });


  // -- invalid_decimals (deploy only) --

  it('should detect invalid decimals (negative)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '-1' };
    expect(getSrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (> 18)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '19' };
    expect(getSrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (not a number)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: 'abc' };
    expect(getSrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (float)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '8.5' };
    expect(getSrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should accept dec=0 (no decimal places)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '0' };
    expect(getSrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should accept dec=18 (maximum)', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '18' };
    expect(getSrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should skip dec validation when dec is undefined (defaults to 18 per spec)', () => {
    const deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100' } as Src20Deploy;
    expect(getSrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should skip dec validation when dec is empty string', () => {
    const deploy: Src20Deploy = { p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100', dec: '' };
    expect(getSrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });


  // -- Multiple flaws at once --

  it('should detect multiple flaws simultaneously', () => {
    // deploy with no ticker, no max, no lim, and bad dec
    const deploy = { p: 'src-20', op: 'deploy', dec: '25' } as unknown as Src20Parsed;
    const flaws = getSrc20Flaws(deploy);
    expect(flaws).toContain('missing_ticker');
    expect(flaws).toContain('missing_max_supply');
    expect(flaws).toContain('missing_mint_limit');
    expect(flaws).toContain('invalid_decimals');
    expect(flaws.length).toBe(4);
  });

  it('should detect missing ticker and missing amount on mint', () => {
    const mint = { p: 'src-20', op: 'mint' } as unknown as Src20Parsed;
    const flaws = getSrc20Flaws(mint);
    expect(flaws).toContain('missing_ticker');
    expect(flaws).toContain('missing_amount');
    expect(flaws.length).toBe(2);
  });
});
