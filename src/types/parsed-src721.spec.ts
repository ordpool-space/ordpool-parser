import { getSrc721Flaws, parseSrc721Content, Src721Deploy, Src721Mint, Src721Parsed } from './parsed-src721';

describe('parseSrc721Content', () => {

  it('should parse a valid deploy', () => {
    const result = parseSrc721Content('{"p":"src-721","op":"deploy","tick":"KEVIN","name":"Kevin Collection"}');
    expect(result).toEqual({ p: 'src-721', op: 'deploy', tick: 'KEVIN', name: 'Kevin Collection' });
  });

  it('should parse a valid mint with collection id and trait indices', () => {
    // Real on-chain shape from testdata/tx_b74313d3...json (stamp #1383566)
    const result = parseSrc721Content('{"p":"src-721","op":"mint","c":"A1473703777372088053","ts":[1,4,8,4,5,4,7,0,6,6]}');
    expect(result).toEqual({
      p: 'src-721',
      op: 'mint',
      c: 'A1473703777372088053',
      ts: [1, 4, 8, 4, 5, 4, 7, 0, 6, 6],
    });
  });

  it('should return null for non-string input', () => {
    expect(parseSrc721Content(null as any)).toBeNull();
    expect(parseSrc721Content(undefined as any)).toBeNull();
    expect(parseSrc721Content(123 as any)).toBeNull();
    expect(parseSrc721Content('')).toBeNull();
  });

  it('should return null for non-JSON content', () => {
    expect(parseSrc721Content('not json')).toBeNull();
    expect(parseSrc721Content('[1,2,3]')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseSrc721Content('{broken')).toBeNull();
  });

  it('should return null when p is not src-721', () => {
    expect(parseSrc721Content('{"p":"src-20","op":"deploy","tick":"TEST"}')).toBeNull();
    expect(parseSrc721Content('{"p":"other","op":"deploy"}')).toBeNull();
  });

  it('should return null for unknown operation', () => {
    expect(parseSrc721Content('{"p":"src-721","op":"transfer"}')).toBeNull();
    expect(parseSrc721Content('{"p":"src-721","op":"burn"}')).toBeNull();
  });
});


describe('getSrc721Flaws', () => {

  // -- Valid cases --

  it('should return no flaws for a valid deploy with tick', () => {
    const deploy: Src721Parsed = { p: 'src-721', op: 'deploy', tick: 'KEVIN' };
    expect(getSrc721Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid deploy with legacy symbol field', () => {
    // Canonical src721.py:40-41 renames `symbol` to `tick`. Accept either.
    const deploy: Src721Parsed = { p: 'src-721', op: 'deploy', symbol: 'KEVIN' };
    expect(getSrc721Flaws(deploy)).toEqual([]);
  });

  it('should return no flaws for a valid mint', () => {
    const mint: Src721Parsed = { p: 'src-721', op: 'mint', c: 'A1473703777372088053', ts: [1, 4, 8] };
    expect(getSrc721Flaws(mint)).toEqual([]);
  });

  it('should return no flaws for a recursive-version deploy (v: r0)', () => {
    // The recursive SRC-721 variant adds a "v" field. parseSrc721Content
    // ignores the variant; the flaw checker only cares about the structural
    // minimum.
    const deploy = { p: 'src-721', op: 'deploy', tick: 'COMP', v: 'r0' } as Src721Deploy;
    expect(getSrc721Flaws(deploy)).toEqual([]);
  });

  // -- missing_collection_symbol --

  it('should detect deploy without tick or symbol', () => {
    const deploy = { p: 'src-721', op: 'deploy', name: 'Anonymous Collection' } as Src721Deploy;
    expect(getSrc721Flaws(deploy)).toContain('missing_collection_symbol');
  });

  it('should detect deploy with empty tick string', () => {
    const deploy = { p: 'src-721', op: 'deploy', tick: '   ' } as Src721Deploy;
    expect(getSrc721Flaws(deploy)).toContain('missing_collection_symbol');
  });

  it('should detect deploy with non-string tick', () => {
    const deploy = { p: 'src-721', op: 'deploy', tick: 123 } as unknown as Src721Deploy;
    expect(getSrc721Flaws(deploy)).toContain('missing_collection_symbol');
  });

  // -- missing_collection_id --

  it('should detect mint without c', () => {
    const mint = { p: 'src-721', op: 'mint', ts: [1, 2, 3] } as Src721Mint;
    expect(getSrc721Flaws(mint)).toContain('missing_collection_id');
  });

  it('should detect mint with empty c', () => {
    const mint = { p: 'src-721', op: 'mint', c: '   ', ts: [1] } as Src721Mint;
    expect(getSrc721Flaws(mint)).toContain('missing_collection_id');
  });

  it('should detect mint with non-string c', () => {
    const mint = { p: 'src-721', op: 'mint', c: 12345 } as unknown as Src721Mint;
    expect(getSrc721Flaws(mint)).toContain('missing_collection_id');
  });

  // -- unknown_op (defense in depth; parseSrc721Content should have caught it) --

  it('should detect unknown_op when called with synthetic invalid op', () => {
    const garbage = { p: 'src-721', op: 'random' } as unknown as Src721Parsed;
    expect(getSrc721Flaws(garbage)).toContain('unknown_op');
  });
});
