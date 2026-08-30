import { DEFAULT_OTS_CALENDARS } from './ots-calendars';

// Pins the canonical public OTS calendar set. This constant is the single
// source of truth both fork sides import as their compiled-in fallback, so a
// silent edit here would silently change both. Positive assertions on every
// entry catch that.

describe('DEFAULT_OTS_CALENDARS', () => {
  it('is the four historical public OpenTimestamps calendars, in order', () => {
    expect(DEFAULT_OTS_CALENDARS.map((c) => c.nickname)).toEqual([
      'alice',
      'bob',
      'finney',
      'catallaxy',
    ]);
    expect(DEFAULT_OTS_CALENDARS.map((c) => c.url)).toEqual([
      'https://alice.btc.calendar.opentimestamps.org',
      'https://bob.btc.calendar.opentimestamps.org',
      'https://finney.calendar.eternitywall.com',
      'https://btc.calendar.catallaxy.com',
    ]);
  });

  it('every entry is a nickname + an https base URL with no trailing slash', () => {
    for (const cal of DEFAULT_OTS_CALENDARS) {
      expect(cal.nickname.length).toBeGreaterThan(0);
      expect(cal.url.startsWith('https://')).toBe(true);
      expect(cal.url.endsWith('/')).toBe(false);
    }
  });

  it('is frozen (the compiled-in fallback must not be mutated at runtime)', () => {
    expect(Object.isFrozen(DEFAULT_OTS_CALENDARS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_OTS_CALENDARS[0])).toBe(true);
  });
});
