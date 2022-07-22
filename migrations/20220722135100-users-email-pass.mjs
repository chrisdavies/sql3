export const up = (sql) => {
  sql.exec`ALTER TABLE users ADD COLUMN email text`;
  sql.exec`ALTER TABLE users ADD COLUMN password text`;
  sql.exec`CREATE UNIQUE INDEX idx_users_email ON users(email)`;
};

export const down = (sql) => {
  sql.exec`DROP INDEX idx_users_email`;
  sql.exec`ALTER TABLE users DROP COLUMN email`;
  sql.exec`ALTER TABLE users DROP COLUMN password`;
};
