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
 * If the value is truthy, build it into the query. Otherwise, this is a noop.
 */
export function when(x) {
  return x ? x : raw('');
}

function isFragment(val) {
  return val && val.type === sqlType;
}

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
