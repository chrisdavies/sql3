/**
 * Cache provides two cache options. One is a noop, which amounts to no
 * caching, and the second is a naive capped cache. It's pretty trivial for
 * others to add their own cache, (e.g. wrapping lru-cache or something),
 * but for my test purposes, this cache performs slightly better and is
 * simpler.
 */

/**
 * Use this to disable caching.
 */
export function noop() {
  return {
    get() {
      return undefined;
    },
    set(_k, v) {
      return v;
    },
  };
}

/**
 * A naive maxSize cache. It evicts the oldest item regardless of how recently
 * that item was used.
 */
export function basic(maxSize = 1000) {
  const items = {};
  const keys = [];
  return {
    get(k) {
      return items[k];
    },
    set(k, v) {
      if (keys.length >= maxSize) {
        delete items[keys[0]];
        keys.shift();
      }
      keys.push(k);
      items[k] = v;
      return v;
    },
  };
}
