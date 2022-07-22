/**
 * This file contains the core logic for running migrations on a database.
 */

import fs from 'fs';
import path from 'path';
import { sql3 } from './index.mjs';

/**
 * Run all of the up migrations in the specified directory.
 */
export async function up({ db, dir }) {
  if (typeof db === 'string') {
    db = sql3({ filename: db });
  }
  const files = fs.readdirSync(dir).sort((a, b) => (a > b ? 1 : -1));
  const sql = db.sync;
  let appliedCount = 0;

  sql.exec`BEGIN`;
  sql.exec`
    CREATE TABLE IF NOT EXISTS migrations (
      filename text primary key,
      applied_at text
    )
  `;
  for (const filename of files) {
    const isApplied = sql.scalar`SELECT filename FROM migrations WHERE filename=${filename}`;
    if (isApplied) {
      continue;
    }
    console.log('[sql3]', filename);
    const migration = await import(path.resolve(path.join(dir, filename)));
    await migration.up(sql);
    sql.exec`
      INSERT INTO migrations (filename, applied_at)
      VALUES (${filename}, ${new Date().toISOString()})
    `;
    ++appliedCount;
  }
  if (!appliedCount) {
    console.log('[sql3] All caught up!');
  }
  sql.exec`COMMIT`;

  return db;
}

/**
 * Run the most recent down migration.
 */
export async function down({ db, dir }) {
  if (typeof db === 'string') {
    db = sql3({ filename: db });
  }
  const sql = db.sync;

  sql.exec`BEGIN`;
  const filename = sql.scalar`SELECT filename FROM migrations ORDER BY applied_at DESC LIMIT 1`;
  if (!filename) {
    console.log('No migrations found.');
    return db;
  }
  console.log('[sql3] Rollback ', filename);
  const migration = await import(path.resolve(path.join(dir, filename)));
  await migration.down(sql);
  sql.exec`
    DELETE FROM migrations
    WHERE filename=${filename}
  `;

  return db;
}

/**
 * Create a new, empty migration file.
 */
export async function create({ dir, suffix }) {
  const prefix = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, -3);
  let filename = `${prefix}-${suffix}`;
  const ext = path.extname(filename);
  if (!ext) {
    filename = filename + '.mjs';
  }
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(
    fullPath,
    [
      'export const up = (sql) => { };',
      'export const down = (sql) => { };',
    ].join('\n\n')
  );
  console.log(`Created migration ${fullPath}`);
}
