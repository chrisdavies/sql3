/**
 * This file contains demo usage of the sql3 module.
 */

import { sql3 } from './init.mjs';
import cluster from 'cluster';

async function initDb() {
  const sql = sql3({
    filename: 'demo.db',
  });

  await sql.exec`DROP TABLE IF EXISTS users`;

  await sql.exec`CREATE TABLE users (
    id integer primary key autoincrement,
    email text unique
  )`;

  sql.close();
}

async function runDemo() {
  const suffix = process.env.FORK;
  const email = (prefix) => `${prefix}${suffix}@example.com`;
  const sql = sql3({
    filename: 'demo.db',
  });
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

  console.log(userId);
  console.log(user);

  console.log(
    sql.all`SELECT * FROM users WHERE email IN (${[
      email('tx1'),
      email('tx2'),
    ]})`
  );

  sql.close();
}

if (cluster.isPrimary) {
  let workerCount = 2;
  cluster.on('exit', () => {
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
    .catch((err) => console.error('secondary error: ', err));
}
