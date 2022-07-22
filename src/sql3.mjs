/**
 * This file wraps an underlying SQLite connection with convenience methods
 * for building and executing queries using template strings.
 */

import cluster from 'cluster';
import * as baseDb from './db.mjs';
import { frag } from './builder.mjs';

export function sql3(opts) {
  const db = baseDb.open(opts);
  const primary = opts.primary;

  const mkfn = (fn) => {
    return (strs, ...vals) => {
      const q = frag(strs, ...vals);
      return fn(db.prepare(q.query), q.args);
    };
  };

  const mkexec = (remoteFn) => {
    return (strs, ...vals) => {
      const q = frag(strs, ...vals);
      return remoteFn(db.name, q.query, q.args);
    };
  };

  const runTx = primary.mkfn((db, queries) => {
    const rawDb = db.rawDb;
    return rawDb.transaction(() => {
      queries.forEach((q) => rawDb.prepare(q.query).run(...q.args));
    })();
  });

  const sql = (...args) => frag(...args);

  const syncMethods = {
    rawDb: db,
    filename: db.name,
    prepare: db.prepare,
    primary,
    close: db.close,

    // Readers
    get: mkfn((stmt, args) => stmt.get(...args)),
    scalar: mkfn((stmt, args) => stmt.pluck().get(...args)),
    all: mkfn((stmt, args) => stmt.all(...args)),
    iter: mkfn((stmt, args) => stmt.iterate(...args)),
  };

  Object.assign(sql, syncMethods, {
    // Writers
    exec: mkexec(
      primary.mkfn((db, query, args) => {
        return db.prepare(query).run(...args);
      })
    ),

    execScalar: mkexec(
      primary.mkfn((db, query, args) => {
        return db
          .prepare(query)
          .pluck()
          .get(...args);
      })
    ),

    execGet: mkexec(
      primary.mkfn((db, query, args) => {
        return db.prepare(query).get(...args);
      })
    ),

    execTx(queries) {
      return runTx(db.name, queries);
    },
  });

  if (cluster.isPrimary) {
    const sync = (...args) => frag(...args);
    sql.sync = sync;
    Object.assign(sync, syncMethods, {
      // Writers
      exec: mkfn((stmt, args) => stmt.run(...args)),
      execScalar: syncMethods.scalar,
      execGet: syncMethods.get,
    });
  }

  return sql;
}
