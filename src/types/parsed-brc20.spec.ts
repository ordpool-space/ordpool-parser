import { BrC20Deploy, BrC20Mint, BrC20Parsed, BrC20Transfer, getBrc20Flaws, parseBrc20Content } from './parsed-brc20';

describe('parseBrc20Content', () => {

  it('should parse a valid deploy', () => {
    const result = parseBrc20Content('{"p":"brc-20","op":"deploy","tick":"ordi","max":"21000000","lim":"1000","dec":"18"}');
    expect(result).toEqual({ p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '18' });
  });

  it('should parse a valid mint', () => {
    const result = parseBrc20Content('{"p":"brc-20","op":"mint","tick":"ordi","amt":"1000"}');
    expect(result).toEqual({ p: 'brc-20', op: 'mint', tick: 'ordi', amt: '1000' });
  });

  it('should parse a valid transfer', () => {
    const result = parseBrc20Content('{"p":"brc-20","op":"transfer","tick":"ordi","amt":"500"}');
    expect(result).toEqual({ p: 'brc-20', op: 'transfer', tick: 'ordi', amt: '500' });
  });

  it('should return null for non-string input', () => {
    expect(parseBrc20Content(null as any)).toBeNull();
    expect(parseBrc20Content(undefined as any)).toBeNull();
    expect(parseBrc20Content(123 as any)).toBeNull();
    expect(parseBrc20Content('' as any)).toBeNull();
  });

  it('should return null for non-JSON content', () => {
    expect(parseBrc20Content('not json')).toBeNull();
    expect(parseBrc20Content('[1,2,3]')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseBrc20Content('{broken')).toBeNull();
  });

  it('should return null when p is not brc-20', () => {
    expect(parseBrc20Content('{"p":"src-20","op":"deploy","tick":"TEST","max":"1000"}')).toBeNull();
    expect(parseBrc20Content('{"p":"other","op":"deploy"}')).toBeNull();
  });

  it('should return null for unknown operation', () => {
    expect(parseBrc20Content('{"p":"brc-20","op":"burn","tick":"ordi"}')).toBeNull();
    expect(parseBrc20Content('{"p":"brc-20","op":"unknown"}')).toBeNull();
  });

  it('should trim whitespace before parsing', () => {
    const result = parseBrc20Content('  {"p":"brc-20","op":"mint","tick":"ordi","amt":"100"}  ');
    expect(result).not.toBeNull();
    expect(result!.op).toBe('mint');
  });

  it('should accept extra fields (ignored per BRC-20 spec)', () => {
    const result = parseBrc20Content('{"p":"brc-20","op":"deploy","tick":"ordi","max":"21000000","random":"test"}');
    expect(result).not.toBeNull();
    expect(result!.op).toBe('deploy');
  });
});


describe('getBrc20Flaws', () => {

  // -- Valid cases (no flaws) --

  it('should return no flaws for a valid deploy', () => {
    const deploy: BrC20Parsed = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '18' };
    expect(getBrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid deploy without optional dec', () => {
    const deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000' } as BrC20Deploy;
    expect(getBrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid deploy with dec=0', () => {
    const deploy: BrC20Parsed = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '0' };
    expect(getBrc20Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid mint', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: 'ordi', amt: '1000' };
    expect(getBrc20Flaws(mint)).toEqual([]);
  });

  it('should return no flaws for a valid transfer', () => {
    const transfer: BrC20Parsed = { p: 'brc-20', op: 'transfer', tick: 'ordi', amt: '500' };
    expect(getBrc20Flaws(transfer)).toEqual([]);
  });

  it('should accept 4-byte UTF-8 tickers (standard BRC-20)', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: 'ORDI', amt: '100' };
    expect(getBrc20Flaws(mint)).toEqual([]);
  });

  it('should accept 5-byte tickers (enabled at block 837,090)', () => {
    const deploy: BrC20Parsed = { p: 'brc-20', op: 'deploy', tick: 'abcde', max: '1000', lim: '100', dec: '8' };
    expect(getBrc20Flaws(deploy)).toEqual([]);
  });

  it('should accept single-character tickers', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: 'X', amt: '100' };
    expect(getBrc20Flaws(mint)).toEqual([]);
  });

  it('should accept tickers up to 20 characters (DB column limit)', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: '12345678901234567890', amt: '100' };
    expect(getBrc20Flaws(mint)).toEqual([]);
  });


  // -- missing_ticker --

  it('should detect missing ticker (undefined)', () => {
    const deploy = { p: 'brc-20', op: 'deploy', max: '1000', lim: '100', dec: '8' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(deploy)).toContain('missing_ticker');
  });

  it('should detect missing ticker (null)', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: null, amt: '100' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (empty string)', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: '', amt: '100' };
    expect(getBrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (whitespace only)', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: '   ', amt: '100' };
    expect(getBrc20Flaws(mint)).toContain('missing_ticker');
  });

  it('should detect missing ticker (not a string)', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: 123, amt: '100' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).toContain('missing_ticker');
  });


  // -- ticker_too_long --

  it('should detect ticker exceeding 20 characters', () => {
    const mint: BrC20Parsed = { p: 'brc-20', op: 'mint', tick: '123456789012345678901', amt: '100' };
    expect(getBrc20Flaws(mint)).toContain('ticker_too_long');
    expect(getBrc20Flaws(mint)).not.toContain('missing_ticker');
  });


  // -- missing_max_supply (deploy only) --

  it('should detect missing max supply (undefined)', () => {
    const deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', lim: '100' } as unknown as BrC20Deploy;
    expect(getBrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (null)', () => {
    const deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: null, lim: '100' } as unknown as BrC20Deploy;
    expect(getBrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (empty string)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '', lim: '100', dec: '8' };
    expect(getBrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (whitespace only)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '  ', lim: '100', dec: '8' };
    expect(getBrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should detect missing max supply (not a string)', () => {
    const deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: 21000000, lim: '100' } as unknown as BrC20Deploy;
    expect(getBrc20Flaws(deploy)).toContain('missing_max_supply');
  });

  it('should NOT check max supply for mint operations', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: 'ordi', amt: '100' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).not.toContain('missing_max_supply');
  });


  // -- missing_amount (mint/transfer only) --

  it('should detect missing amount on mint (undefined)', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: 'ordi' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on mint (null)', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: 'ordi', amt: null } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on mint (empty string)', () => {
    const mint: BrC20Mint = { p: 'brc-20', op: 'mint', tick: 'ordi', amt: '' };
    expect(getBrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should detect missing amount on transfer (undefined)', () => {
    const transfer = { p: 'brc-20', op: 'transfer', tick: 'ordi' } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(transfer)).toContain('missing_amount');
  });

  it('should detect missing amount on transfer (whitespace only)', () => {
    const transfer: BrC20Transfer = { p: 'brc-20', op: 'transfer', tick: 'ordi', amt: '  ' };
    expect(getBrc20Flaws(transfer)).toContain('missing_amount');
  });

  it('should detect missing amount (not a string)', () => {
    const mint = { p: 'brc-20', op: 'mint', tick: 'ordi', amt: 100 } as unknown as BrC20Parsed;
    expect(getBrc20Flaws(mint)).toContain('missing_amount');
  });

  it('should NOT check amount for deploy operations', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '18' };
    expect(getBrc20Flaws(deploy)).not.toContain('missing_amount');
  });


  // -- invalid_decimals (deploy only) --

  it('should detect invalid decimals (negative)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '-1' };
    expect(getBrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (> 18)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '19' };
    expect(getBrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (not a number)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: 'abc' };
    expect(getBrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should detect invalid decimals (float)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '8.5' };
    expect(getBrc20Flaws(deploy)).toContain('invalid_decimals');
  });

  it('should accept dec=0 (no decimal places)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '0' };
    expect(getBrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should accept dec=18 (maximum)', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '18' };
    expect(getBrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should skip dec validation when dec is undefined (defaults to 18 per spec)', () => {
    const deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000' } as BrC20Deploy;
    expect(getBrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });

  it('should skip dec validation when dec is empty string', () => {
    const deploy: BrC20Deploy = { p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000', lim: '1000', dec: '' };
    expect(getBrc20Flaws(deploy)).not.toContain('invalid_decimals');
  });


  // -- Multiple flaws at once --

  it('should detect multiple flaws simultaneously', () => {
    // deploy with no ticker AND no max -- two flaws
    const deploy = { p: 'brc-20', op: 'deploy', dec: '25' } as unknown as BrC20Parsed;
    const flaws = getBrc20Flaws(deploy);
    expect(flaws).toContain('missing_ticker');
    expect(flaws).toContain('missing_max_supply');
    expect(flaws).toContain('invalid_decimals');
    expect(flaws.length).toBe(3);
  });

  it('should detect missing ticker and missing amount on mint', () => {
    const mint = { p: 'brc-20', op: 'mint' } as unknown as BrC20Parsed;
    const flaws = getBrc20Flaws(mint);
    expect(flaws).toContain('missing_ticker');
    expect(flaws).toContain('missing_amount');
    expect(flaws.length).toBe(2);
  });


  // -- The real-world bug case: block 790,148 --
  // This is the exact case that caused the SQL syntax error: a BRC-20 deploy
  // inscription with undefined ticker that produced LEFT(, 20) in SQL

  it('should catch the block 790,148 bug case (deploy with undefined ticker)', () => {
    const garbageDeploy = { p: 'brc-20', op: 'deploy', max: '1000' } as unknown as BrC20Parsed;
    const flaws = getBrc20Flaws(garbageDeploy);
    expect(flaws).toContain('missing_ticker');
  });
});
