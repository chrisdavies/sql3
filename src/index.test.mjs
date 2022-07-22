/**
 * This file contains demo usage of the sql3 module.
 */

import * as assert from 'assert';
import { sql3 } from './index.mjs';
import fs from 'fs';
import cluster from 'cluster';
import { mkPrimaryTxFn } from './sql3.mjs';

const dbname = './tmp/demo.db';

const mkdir = (dir) => {
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (err.code === 'EEXIST') {
      return;
    }
    throw err;
  }
};

async function initDb() {
  mkdir('./tmp');

  const sql = sql3({ filename: dbname });

  await sql.exec`DROP TABLE IF EXISTS users`;

  await sql.exec`CREATE TABLE users (
    id integer primary key autoincrement,
    email text unique
  )`;

  sql.close();
}

const createUsers = mkPrimaryTxFn((tx, emails) => {
  return emails.map(
    (email) =>
      tx.execScalar`
      INSERT INTO users (email) VALUES (${email}) RETURNING id
    `
  );
});

async function runDemo() {
  const suffix = process.env.FORK;
  const email = (prefix) => `${prefix}${suffix}@example.com`;
  const sql = sql3({ filename: dbname });
  const userId = await sql.execScalar`
    INSERT INTO users (email) VALUES (${email('me')}) RETURNING id
  `;
  const user = await sql.execGet`
    INSERT INTO users (email) VALUES (${email('you')}) RETURNING *
  `;
  await sql.execTx([
    sql`INSERT INTO users (email) VALUES (${email('tx1')})`,
    sql`INSERT INTO users (email) VALUES (${email('tx2')})`,
  ]);
  const txUsers = sql.all`SELECT * FROM users WHERE email IN (${[
    email('tx1'),
    email('tx2'),
  ]})`;

  const userIds = await createUsers(sql, [email('a-'), email('b-')]);
  const fnUsers = await sql.all`SELECT * FROM users WHERE id IN (${userIds})`;

  assert.ok(typeof userId === 'number');
  assert.ok(typeof user.id === 'number');
  assert.deepStrictEqual(user.email, email('you'));
  assert.deepStrictEqual(
    txUsers.map((x) => x.email),
    [email('tx1'), email('tx2')]
  );
  assert.deepStrictEqual(
    fnUsers.map((x) => x.email),
    [email('a-'), email('b-')]
  );

  sql.close();
}

if (cluster.isPrimary) {
  let workerCount = 2;
  cluster.on('exit', (_worker, exitCode) => {
    if (exitCode) {
      process.exit(exitCode);
    }
    if (--workerCount <= 0) {
      process.exit();
    }
  });
  initDb()
    .then(() => {
      for (let i = 0; i < workerCount; ++i) {
        cluster.fork({ FORK: `-wrk${i}` });
      }
    })
    .catch((err) => console.error('primary error: ', err));
} else {
  runDemo()
    .then(() => process.exit())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
