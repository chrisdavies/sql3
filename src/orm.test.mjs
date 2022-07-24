import { sql3 } from './index.mjs';
import { orm } from './orm.mjs';
import * as assert from 'assert';

const sql = sql3();

async function demo() {
  const db = orm(sql);

  sql.sync.exec`CREATE TABLE users (
    id integer primary key autoincrement,
    email text,
    name text
  )`;

  sql.sync.exec`CREATE TABLE "Weird""name'$!" (
    id integer primary key autoincrement,
    "a ""good"" man's hard to find" text
  )`;

  const user = (name) => ({
    name,
    email: name.toLowerCase() + '@example.com',
  });

  assert.deepStrictEqual(await db.users.insert(user('George')), {
    changes: 1,
    lastInsertRowid: 1,
  });

  assert.deepStrictEqual(
    await db.users.insert([user('Jim'), user('Jane')], { returning: '*' }),
    [
      { id: 2, email: 'jim@example.com', name: 'Jim' },
      { id: 3, email: 'jane@example.com', name: 'Jane' },
    ]
  );

  assert.deepStrictEqual(
    await db.users.update({ id: 3, name: 'Jimbo' }, { returning: 'name' }),
    [{ name: 'Jimbo' }]
  );
  assert.deepStrictEqual(
    await db.users.update(
      { id: 3, name: undefined },
      { returning: ['id', 'name'] }
    ),
    [{ id: 3, name: null }]
  );
  assert.deepStrictEqual(
    await db.users.update({ id: 2, name: null }, { returning: ['id', 'name'] }),
    [{ id: 2, name: null }]
  );

  assert.deepStrictEqual(
    await db.users.update(
      { name: 'Janet' },
      { where: { email: 'jane@example.com' }, returning: 'name' }
    ),
    [{ name: 'Janet' }]
  );

  assert.deepStrictEqual(db.users(1), [
    { id: 1, email: 'george@example.com', name: 'George' },
  ]);
  assert.deepStrictEqual(db.users([1, 2, 3]), [
    { id: 1, email: 'george@example.com', name: 'George' },
    { id: 2, email: 'jim@example.com', name: null },
    { id: 3, email: 'jane@example.com', name: 'Janet' },
  ]);
  assert.deepStrictEqual(db.users({ email: 'jane@example.com' }), [
    { id: 3, email: 'jane@example.com', name: 'Janet' },
  ]);

  const assertChanges = async (p) => {
    const { changes } = await p;
    assert.equal(changes, 1);
  };
  assertChanges(await db.users.delete(1));
  assertChanges(await db.users.delete([2]));
  assertChanges(await db.users.delete({ email: 'jane@example.com' }));

  const weirdTable = db[`Weird"name'$!`];
  weirdTable.insert({
    'a "good" man\'s hard to find': 'tru dat',
  });
  assert.deepStrictEqual(
    weirdTable(1)[0][`a "good" man's hard to find`],
    'tru dat'
  );
}

demo()
  .then(() => {
    sql.close();
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
