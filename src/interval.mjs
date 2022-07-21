/**
 * Helpers for converting strings like '2s' to milliseconds.
 * Example intervals: '500ms', '1s', '1m', '1h', '1d'.
 */

/**
 * Map of units to milliseconds. Used to translate human-friendly interval
 * strings to milliseconds.
 */
const unitsToMs = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const unitRe = /[a-z].*/;

/**
 * Convert an interval string to milliseconds. A number is assumed to already
 * be in milliseconds, and is simply returned as a convenience.
 *
 * Exmaples:
 *
 *    intervalToMs('4s') // 4000
 *    intervalToMs('400ms') // 400
 */
export function intervalToMs(interval) {
  if (interval == null) {
    return;
  }
  if (typeof interval === 'number') {
    return interval;
  }
  const i = parseInt(interval);
  const matchUnit = unitRe.exec(interval);
  if (!matchUnit) {
    // The interval is probably a numeric string. We could be more strict,
    // but this seems reasonable enough.
    return i;
  }
  const unit = unitsToMs[matchUnit[0]];
  if (!unit) {
    throw new Error(
      `Unsupported time interval ${interval}, must be one of ${Object.keys(
        unitsToMs
      ).join(', ')}`
    );
  }
  return i * unit;
}
