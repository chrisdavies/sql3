/**
 * The global initialization mechanism. A global init is required in order for
 * the primary write layer to work.
 */

import * as pools from './pool.mjs';
import { sql3 as baseSQL3, mkPrimaryTxFn } from './sql3.mjs';
import { primaryFn } from './primary-fn.mjs';

let pool = pools.basic({ open: (filename) => baseSQL3({ filename, primary }) });
let primary = primaryFn((fn, [db, ...args]) => {
  const filename = db.filename || db;
  const conn = pool.get(filename);
  if (db.tx) {
    return conn.rawDb.transaction(() => fn(conn.sync, ...args))();
  } else {
    return fn(conn.sync, ...args);
  }
});

export function init(opts = {}) {
  if (opts.pool) {
    pool = opts.pool;
  }
  if (opts.primary) {
    primary = opts.primary;
  }
}

export const sql3 = (opts = {}) => {
  const db = baseSQL3({
    ...opts,
    primary: opts.primary || primary,
  });
  pool.set(db);
  return db;
};

export const primaryTxFn = mkPrimaryTxFn;
