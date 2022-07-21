/**
 * Optimizer functions used for periodically running maintenance on the
 * underlying SQLite instance. This is only started on the cluter primary.
 */

import { intervalToMs } from './interval.mjs';

/**
 * Use this to disable background optimizing.
 */
export function noop() {
  return { close() {} };
}

/**
 * Run prgama optimize periodically to keep the database in decent health.
 */
export function basic(interval = '1h') {
  return (db) => {
    const ms = intervalToMs(interval);
    let timeout = setTimeout(function optimize() {
      db.pragma('optimize');
      timeout = setTimeout(optimize, ms);
    }, ms);
    return {
      close() {
        clearTimeout(timeout);
      },
    };
  };
}
