/*
 * A simple ORM layer for basic, common queries. More complex things should
 * be done with the builders.
 */

import * as B from '../src/builder.mjs';

/**
 * Handle the returning clause of an insert or update operation.
 */
function returningClause(returning) {
  if (!returning) {
    return B.frag``;
  }
  if (returning === '*') {
    return B.frag`RETURNING *`;
  }
  returning = Array.isArray(returning) ? returning : [returning];
  return B.frag`RETURNING ${returning.map(B.name)}`;
}

/**
 * Create a very basic ORM.
 */
export function orm(db, cmd = []) {
  const fn = (...props) => {
    const [table, action = 'select'] = cmd;
    const [rec, opts = {}] = props;

    if (action === 'insert') {
      const method = !opts.returning ? 'exec' : 'all';
      return db[method]`INSERT INTO ${B.name(table)} ${B.insertCols(
        rec
      )} ${returningClause(opts.returning)}`;
    }

    if (action === 'update') {
      const method = !opts.returning ? 'exec' : 'all';
      return db[method]`UPDATE ${B.name(table)} SET ${B.setCols(
        rec,
        opts.where
      )} ${returningClause(opts.returning)}`;
    }

    let whereObj = rec;
    if (Array.isArray(rec) || typeof rec !== 'object') {
      whereObj = { id: rec };
    }

    if (action === 'delete') {
      return db.exec`DELETE FROM ${B.name(table)} ${B.objToWhere(whereObj)}`;
    }

    if (action === 'select') {
      return db.all`SELECT * FROM ${B.name(table)} ${B.objToWhere(whereObj)}`;
    }

    throw new Error(`Unknown action ${action}`);
  };

  return new Proxy(fn, {
    get(_target, prop) {
      if (typeof prop === 'string') {
        return orm(db, [...cmd, prop]);
      }
      throw new Error(`Unknown prop ${prop}`);
    },
  });
}
