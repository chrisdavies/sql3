/**
 * This file contains demo usage of the sql3 module.
 */

import { sql3 } from './index.mjs';

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
    console.log(sql.all`
      SELECT *
      FROM (
        SELECT column1 "id", column2 "email" FROM (
          VALUES (1, 'george@example.com'), (2, 'jane@example.com')
        )
      )
      ${where.id ? sql`WHERE id=${where.id}` : sql``}
      ${where.email ? sql`WHERE email=${where.email}` : sql``}
    `);
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

  console.log(users);
  console.log(user);
  console.log(userId);
  for (const row of iter) {
    console.log(row);
  }
  demoWhere({ id: 2 });
  demoWhere({ email: 'george@example.com' });
  console.log(matches);
  console.log(subArray);

  sql.close();
}

runDemo();
