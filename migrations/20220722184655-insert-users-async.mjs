import { promisify } from 'util';
import crypto from 'crypto';

const scrypt = promisify(crypto.scrypt);

const adminEmail = 'fancipants@example.com';

async function hashPass(pass) {
  const salt = crypto.randomBytes(24).toString('base64url');
  const hash = await scrypt(pass, salt, 64);
  return `${salt}/${hash.toString('base64url')}`;
}

export const up = async (sql) => {
  const pass = await hashPass('topsecret!!!');
  sql.exec`
    INSERT INTO users (email, password)
    VALUES (${adminEmail}, ${pass})
  `;
};

export const down = (sql) => {
  sql.exec`
    DELETE FROM users WHERE email=${adminEmail}
  `;
};
