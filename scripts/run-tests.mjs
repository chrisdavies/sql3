import fs from 'fs';
import childProcess from 'child_process';
import path from 'path';

export const logErr = (...args) =>
  console.log('\x1b[1m\x1b[31m%s\x1b[0m', ...args);

export const logOK = (...args) =>
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', ...args);

async function runTests(dir) {
  const testFiles = fs.readdirSync(dir).filter((s) => s.endsWith('.test.mjs'));
  for (const filename of testFiles) {
    const fullPath = path.join(dir, filename);
    const proc = childProcess.spawnSync('node', [fullPath]);
    if (proc.error || proc.status) {
      console.log(proc.stderr.toString());
      console.log(proc.stdout.toString());
      proc.error && console.error(proc.error);
      logErr(`FAIL ${fullPath} `, `(${proc.status})`);
      process.exit(1);
    } else {
      logOK(`OK ${fullPath}`);
    }
  }
}

runTests('./src');
