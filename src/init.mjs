/**
 * The global initialization mechanism. A global init is required in order for
 * the primary write layer to work.
 */

import * as pools from './pool.mjs';
import { sql3 as baseSQL3 } from './sql3.mjs';
import { primaryFn } from './primary-fn.mjs';

let pool = pools.basic({ open: (filename) => baseSQL3({ filename, primary }) });
let primary = primaryFn((fn, [filename, ...args]) =>
  fn(pool.get(filename), ...args)
);

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
