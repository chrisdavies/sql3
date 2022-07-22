/**
 * A pool provides opened DB connections to the callers. If a worker requests
 * a write / transaction on the primary, and the primary doesn't have the
 * required database, the pool will open it.
 *
 * TODO: create a pool that closes / evicts databases after a configurable
 * idle time.
 */

export function basic({ open }) {
  const connections = {};

  const addDb = (db) => {
    const baseClose = db.close.bind(db);
    db.close = () => {
      baseClose();
      delete connections[db.filename];
    };
    connections[db.filename] = db;
    return db;
  };

  return {
    set: addDb,
    get(filename) {
      return connections[filename] || addDb(open(filename));
    },
  };
}
