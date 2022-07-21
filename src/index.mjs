import fs from 'fs';

fs.readdirSync('.').forEach((x) => {
  console.log(x);
});

