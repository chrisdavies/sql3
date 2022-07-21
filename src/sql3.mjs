/**
 * This file wraps an underlying SQLite connection with convenience methods
 * for building and executing queries using template strings.
 */

import * as baseDb from './db.mjs';
import { frag } from './builder.mjs';

export function sql3(opts) {
  const db = baseDb.open(opts);

  const mkfn = (fn) => {
    return (strs, ...vals) => {
      const q = frag(strs, ...vals);
      return fn(db.prepare(q.query), q.args);
    };
  };

  const sql = frag;

  Object.assign(sql, {
    rawDb: db,
    filename: db.name,
    get: mkfn((stmt, args) => stmt.get(...args)),
    scalar: mkfn((stmt, args) => stmt.pluck().get(...args)),
    all: mkfn((stmt, args) => stmt.all(...args)),
    iter: mkfn((stmt, args) => stmt.iterate(...args)),
    close: () => db.close(),
  });

  return sql;
}
