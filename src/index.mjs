import { open } from './db.mjs';

const db = open();

console.log(db.prepare('SELECT 42 "age"').get());

db.close();

