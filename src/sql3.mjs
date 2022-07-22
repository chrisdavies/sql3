/**
 * This file wraps an underlying SQLite connection with convenience methods
 * for building and executing queries using template strings.
 */

import cluster from 'cluster';
import * as baseDb from './db.mjs';
import { frag } from './builder.mjs';

const mkPrimaryFn = (tx) => (fn) => {
  const fnstr = fn.toString();
  return (db, ...args) => {
    return db.primary.send({
      fn: fnstr,
      args: [{ filename: db.filename, tx }, ...args],
    });
  };
};

const mkWriterFn = mkPrimaryFn();

export const mkPrimaryTxFn = mkPrimaryFn(true);

export function sql3(opts) {
  const db = baseDb.open(opts);
  const primary = opts.primary;
  const sql = (...args) => frag(...args);

  const mkfn = (fn) => {
    return (strs, ...vals) => {
      const q = frag(strs, ...vals);
      return fn(db.prepare(q.query), q.args);
    };
  };

  const mkexec = (remoteFn) => {
    return (strs, ...vals) => {
      const q = frag(strs, ...vals);
      return remoteFn(sql, q.query, q.args);
    };
  };

  const runTx = mkPrimaryTxFn((tx, queries) => {
    queries.forEach((q) => tx.rawDb.prepare(q.query).run(...q.args));
  });

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
      mkWriterFn((db, query, args) => db.rawDb.prepare(query).run(...args))
    ),
    execScalar: mkexec(
      mkWriterFn((db, query, args) =>
        db.rawDb
          .prepare(query)
          .pluck()
          .get(...args)
      )
    ),
    execGet: mkexec(
      mkWriterFn((db, query, args) => db.rawDb.prepare(query).get(...args))
    ),
    execTx: (queries) => runTx(sql, queries),
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
