/**
 * The default public OpenTimestamps calendar set — the historical calendars
 * every OTS client ships with. Single source of truth for the compiled-in
 * fallback list on both fork sides (ordpool frontend + backend) and any future
 * consumer: each imports this instead of hardcoding its own copy.
 *
 * The backend's runtime `ots-calendars.json` still OVERRIDES this at boot (add
 * a calendar without a redeploy). This constant is the safety net used when
 * that file is missing/corrupt, or when a client has no server to ask.
 *
 * `nickname` is the display name AND the stable identifier: the backend stores
 * it as-is in the `ordpool_stats_ots.calendar` column, so an existing entry's
 * nickname must never be renamed (it would orphan that calendar's stats rows).
 */
export interface OtsCalendar {
  /** Display name AND stable identifier (also the per-calendar stats DB key). */
  nickname: string;
  /** Base URL, no trailing slash; the host a client POSTs `/digest` against. */
  url: string;
}

/** The four historical public OpenTimestamps calendars. */
export const DEFAULT_OTS_CALENDARS: ReadonlyArray<OtsCalendar> = Object.freeze([
  Object.freeze({ nickname: 'alice',     url: 'https://alice.btc.calendar.opentimestamps.org' }),
  Object.freeze({ nickname: 'bob',       url: 'https://bob.btc.calendar.opentimestamps.org' }),
  Object.freeze({ nickname: 'finney',    url: 'https://finney.calendar.eternitywall.com' }),
  Object.freeze({ nickname: 'catallaxy', url: 'https://btc.calendar.catallaxy.com' }),
]);
