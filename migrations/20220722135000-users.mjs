export const up = (sql) => {
  sql.exec`
    CREATE TABLE users (
      id integer primary key autoincrement
    )
  `;
};

export const down = (sql) => {
  sql.exec`
    DROP TABLE IF EXISTS users
  `;
};
