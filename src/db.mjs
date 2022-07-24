/**
 * This file wraps better-sqlite3 with some added conveniences, such as:
 *
 * - Pragma initialization
 * - Background optimizer
 * - Prepared statement cache
 */

import * as cache from './cache.mjs';
import * as optimizer from './optimizer.mjs';
import cluster from 'cluster';
import workers from 'worker_threads';
import Database from 'better-sqlite3';
import { intervalToMs } from './interval.mjs';

export const inMemoryFilename = ':memory:';

export const defaultOpts = {
  filename: inMemoryFilename,
  pragmas: {
    journal_mode: 'WAL',
    synchrounous: 'normal',
  },
  timeout: '5s',
  fileMustExist: false,
  cache: cache.basic(),
  optimizer: optimizer.basic(),
  nativeBinding: `node_modules/better-sqlite3/build/Release/better_sqlite3.node`,
};

function setPragmas(db, pragmas) {
  for (const k in pragmas) {
    db.pragma(`${k} = ${pragmas[k]}`);
  }
}

/**
 * Open a new SQLite database using the specified options.
 */
export function open(opts = defaultOpts) {
  opts = { ...defaultOpts, ...opts };

  const readonly =
    (cluster.isWorker || !workers.isMainThread) &&
    opts.filename !== inMemoryFilename;
  const { cache } = opts;
  const db = new Database(opts.filename, {
    // The primary is the only writer all others delegate writes to the primary.
    // The exception to this is :memory: instances which are thread local.
    readonly,
    fileMustExist: !!opts.fileMustExist,
    timeout: intervalToMs(opts.timeout),
    nativeBinding: opts.nativeBinding,
    verbose: opts.verbose,
  });

  // Start the optimizer. We only want to start the *real* optimizer on
  // writable nodes (e.g. on the primary, etc)
  const optimizerInst = readonly ? optimizer.noop() : opts.optimizer(db);

  // Set up the requested pragmas.
  setPragmas(db, opts.pragmas || defaultOpts.pragmas);

  // Override the db prepare method so that it uses the specified cache.
  const basePrepare = db.prepare.bind(db);
  db.prepare = function prepare(query) {
    let stmt = cache.get(query);
    if (!stmt) {
      stmt = basePrepare(query);
      cache.set(query, stmt);
    }
    return stmt;
  };

  // Override the db close method so that it also closes any processes we're
  // running on our own.
  const baseClose = db.close.bind(db);
  db.close = function close() {
    baseClose();
    optimizerInst.close();
  };

  return db;
}
