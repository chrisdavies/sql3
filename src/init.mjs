/**
 * The global initialization mechanism. A global init is required in order for
 * the primary write layer to work.
 */

import * as pools from './pool.mjs';
import { sql3 as baseSQL3 } from './sql3.mjs';
import { primaryFn } from './primary-fn.mjs';

let pool = pools.basic({ open: (filename) => baseSQL3({ filename, primary }) });
let primary = primaryFn((fn, [db, ...args]) => {
  const filename = db.filename || db;
  if (db.filename) {
    const db = pool.get(filename);
    return db.rawDb.transaction(() => {
      return fn(db.sync, ...args);
    })();
  } else {
    return fn(pool.get(filename), ...args);
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

sql3.txFn = (fn) => {
  const fnstr = fn.toString();
  return (db, ...args) => {
    return db.primary.send({
      fn: fnstr,
      args: [{ filename: db.filename, tx: true }, ...args],
    });
  };
};
