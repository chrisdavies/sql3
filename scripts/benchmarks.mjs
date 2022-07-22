/**
 * A simple service for testing performance via hey.
 */

import cluster from 'node:cluster';
import http from 'http';
import fs from 'fs';
import Database from 'better-sqlite3';
import { cpus } from 'node:os';
import { sql3, primaryTxFn } from '../src/index.mjs';
import path from 'path';

const dbdir = '../tmp';
const dbname = path.join(dbdir, './bench.db');
const numRecs = 100000;

function mkdir(dir) {
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (err.code === 'EEXIST') {
      return;
    }
    throw err;
  }
}

const genUsers = primaryTxFn((tx, numRecs) => {
  for (let i = 0; i < numRecs; ++i) {
    tx.exec`
      INSERT INTO users (id, num_writes, email)
        VALUES (${i}, 0, ${`user${i}@example.com`});
    `;
  }
});

const incUser = primaryTxFn((tx, userId) => {
  return tx.exec`
    UPDATE users
    SET num_writes=num_writes+1
    WHERE id=${userId}
  `;
});

async function startPrimary() {
  mkdir(dbdir);
  const sql = sql3({ filename: dbname });
  sql.exec`DROP TABLE IF EXISTS users`;
  sql.exec`
    CREATE TABLE users (
      id integer primary key,
      num_writes integer,
      email email
    );
  `;

  console.log(`Generating ${numRecs} sample records ...`);
  await genUsers(sql, numRecs);

  console.log('Starting workers ...');
  const numCPUs = cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
}

function getRawUpdater() {
  const db = new Database(dbname, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('synchrounous = normal');

  return db.prepare(`
    UPDATE users
    SET num_writes=num_writes+1
    WHERE id=?
  `);
}

function startWorker() {
  console.log(`Started worker ${process.pid}`);
  const sql = sql3({ filename: dbname });
  const ids = new Array(40).fill(0).map((_, i) => i + 100);
  const rawUpdate = getRawUpdater();

  http
    .Server(async (req, res) => {
      let result = '';
      let statusCode = 200;
      if (req.url.startsWith('/all')) {
        result = JSON.stringify(sql.all`
          select *
          from users u
          where u.id IN (${ids})
        `);
      } else if (req.url.startsWith('/one')) {
        const url = new URL(req.url, 'http://example');
        const id = url.searchParams.get('id') || ids[0];
        result = JSON.stringify(sql.get`
          select *
          from users u
          where u.id=${id}
        `);
      } else if (req.url.startsWith('/scalar')) {
        result = JSON.stringify(sql.scalar`
          select u.id
          from users u
          where u.id=${ids[0]}
        `);
      } else if (req.url.startsWith('/tx')) {
        result = JSON.stringify(
          await incUser(sql, Math.floor(Math.random() * numRecs))
        );
      } else if (req.url.startsWith('/raw')) {
        result = JSON.stringify(
          rawUpdate.run(Math.floor(Math.random() * numRecs))
        );
      } else if (req.url.startsWith('/write')) {
        result = JSON.stringify(
          await sql.exec`
          UPDATE users
          SET num_writes=num_writes+1
          WHERE id=${Math.floor(Math.random() * numRecs)}
        `
        );
      } else {
        statusCode = 404;
        result = '404 | Not found';
      }
      res.writeHead(statusCode);
      res.end(result);
    })
    .listen(3000);
}

if (cluster.isPrimary) {
  startPrimary();
} else {
  startWorker();
}
