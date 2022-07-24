/**
 * This file contains logic to convert a template string into a sql fragment.
 */

/**
 * Identifies an argument as a SQL fragment or query.
 */
const sqlType = Symbol();

/**
 * Place the specified string directly into the query. This is dangerous and
 * a possible source of injections. The string should *never* be user input,
 * but rather known, safe values.
 */
export function raw(s) {
  return {
    type: sqlType,
    query: s,
    args: [],
  };
}

/**
 * Escape the specified string so that it is safe to use as a table or column
 * name in a query. This returns the string.
 */
export function esc(s) {
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Escape the specified string so that it is safe to use as a table or column
 * name in a query. This returns a SQL fragment.
 */
export function name(s) {
  return raw(esc(s));
}

/**
 * Generate an insert cols + values clause from an object or array of objects.
 */
export function insertCols(objOrArr) {
  const obj = Array.isArray(objOrArr) ? objOrArr[0] : objOrArr;
  const cols = Object.keys(obj);
  const arr = Array.isArray(objOrArr) ? objOrArr : [objOrArr];
  const values = arr.map((o) => frag`(${cols.map((c) => frag`${o[c]}`)})`);
  return frag`(${cols.map((col) => name(col))}) VALUES ${values}`;
}

/**
 * Convert an object to a where clause.
 */
export function objToWhere(obj) {
  return frag`WHERE ${Object.entries(obj).map(
    ([k, v]) =>
      frag`${name(k)} ${Array.isArray(v) ? frag`IN (${v})` : frag`=${v}`}`
  )}`;
}

/**
 * Generate the set columns of an update clause from an object.
 */
export function setCols({ id, ...obj }, whereObj) {
  if (!whereObj && id == null) {
    throw new Error(`Cannot perform update without an id or where clause.`);
  }
  whereObj = whereObj || { id };
  const whereClause = objToWhere(whereObj);
  return Object.entries(obj).map(
    ([k, v]) => frag`${name(k)}=${v} ${whereClause}`
  );
}

/**
 * If the value is truthy, build it into the query. Otherwise, this is a noop.
 */
export function when(x) {
  return x ? x : raw('');
}

/**
 * Determine whether or not the specified value is a SQL fragment.
 */
function isFragment(val) {
  return val && val.type === sqlType;
}

/**
 * Determine whether or not the specified array is a SQL fragment.
 */
function isFragmentArray(arr) {
  return Array.isArray(arr) && arr[0]?.type === sqlType;
}

/**
 * A template function that builds a SQL fragment.
 *
 * Example:
 *
 *    const q = sqlt`SELECT * FROM users WHERE id=${userId}`;
 *
 *    q.query === 'SELECT * FROM users WHERE id=?';
 *    JSON.stringify(q.args) === JSON.stringify([userId]);
 */
export function frag(strs, ...vals) {
  if (!strs.raw) {
    throw new Error(`SQL builders must be called as a template string.`);
  }

  const query = [];
  const args = [];

  for (let i = 0; i < strs.length; ++i) {
    query.push(strs[i]);

    if (i >= vals.length) {
      continue;
    }

    const val = vals[i];
    if (isFragment(val)) {
      query.push(val.query);
      args.push(...val.args);
    } else if (isFragmentArray(val)) {
      val.forEach((x, i) => {
        if (i) {
          query.push(',');
        }
        query.push(x.query);
        args.push(...x.args);
      });
    } else if (Array.isArray(val)) {
      // We could expand this to ?,?,?,etc, but it prevents us from being
      // able to cache the query (as that would be a really dynamic list),
      // and it turns out that the json_each approach is as fast or faster
      // in all scenarios I tested.
      args.push(JSON.stringify(val));
      query.push('SELECT value FROM json_each(?)');
    } else {
      args.push(val === undefined ? null : val);
      query.push('?');
    }
  }

  return {
    type: sqlType,
    query: query.join(''),
    args,
  };
}
