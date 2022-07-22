/**
 * This file contains demo usage of the sql3 module.
 */

import { sql3 } from './index.mjs';
import * as assert from 'assert';

function runDemo() {
  const sql = sql3();
  const name = 'Mr Jetson';
  const users = sql.all`SELECT 32 "id", ${name} "name"`;
  const user = sql.get`SELECT 32 "id", ${name} "name"`;
  const userId = sql.scalar`SELECT 32 "id", ${name} "name"`;
  const iter = sql.iter`SELECT column1 "id", column2 "name" FROM (
    VALUES (1, 'George'), (2, 'Jetson')
  )`;
  const demoWhere = (where) => {
    return sql.all`
      SELECT *
      FROM (
        SELECT column1 "id", column2 "email" FROM (
          VALUES (1, 'george@example.com'), (2, 'jane@example.com')
        )
      )
      ${where.id ? sql`WHERE id=${where.id}` : sql``}
      ${where.email ? sql`WHERE email=${where.email}` : sql``}
    `;
  };
  const matches = sql.all`
      SELECT *
      FROM (
        SELECT column1 "id", column2 "email" FROM (
          VALUES
            (1, 'calvin@example.com'),
            (2, 'hobbes@example.com'),
            (3, 'suzie@example.com')
        )
      )
      WHERE id IN (${[2, 3]})
  `;
  const subArray = sql.all`
    SELECT column1 "id", column2 "seq"
    FROM (
      VALUES
        ${[10, 11, 12].map((id, i) => sql`(${id}, ${i})`)}
    )
  `;

  assert.deepStrictEqual(users, [{ id: 32, name: 'Mr Jetson' }]);
  assert.deepStrictEqual(user, { id: 32, name: 'Mr Jetson' });
  assert.equal(userId, 32);
  const iterUsers = [];

  for (const row of iter) {
    iterUsers.push(row);
  }
  assert.deepStrictEqual(iterUsers, [
    { id: 1, name: 'George' },
    { id: 2, name: 'Jetson' },
  ]);

  assert.deepStrictEqual(demoWhere({ id: 2 }), [
    { id: 2, email: 'jane@example.com' },
  ]);
  assert.deepStrictEqual(demoWhere({ email: 'george@example.com' }), [
    { id: 1, email: 'george@example.com' },
  ]);
  assert.deepStrictEqual(matches, [
    { id: 2, email: 'hobbes@example.com' },
    { id: 3, email: 'suzie@example.com' },
  ]);
  assert.deepStrictEqual(subArray, [
    { id: 10, seq: 0 },
    { id: 11, seq: 1 },
    { id: 12, seq: 2 },
  ]);

  sql.close();
}

runDemo();
