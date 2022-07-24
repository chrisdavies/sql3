import fs from 'fs';
import childProcess from 'child_process';
import path from 'path';
import os from 'os';

const numCpus = os.cpus().length;

const logErr = (...args) => console.log('\x1b[1m\x1b[31m%s\x1b[0m', ...args);

const logOK = (...args) => console.log('\x1b[1m\x1b[32m%s\x1b[0m', ...args);

const elapsed = (start) => `${((Date.now() - start) / 1000).toFixed(2)}s`;

async function runTest(fullPath) {
  const fileStart = Date.now();
  const proc = await new Promise((ok) => {
    const child = childProcess.execFile(
      'node',
      [fullPath],
      (error, stdout, stderr) => {
        ok({ error, stdout, stderr, status: child.exitCode });
      }
    );
  });

  if (proc.error || proc.status) {
    console.log(proc.stderr.toString());
    console.log(proc.stdout.toString());
    proc.error && console.error(proc.error);
    logErr(`[FAIL] ${fullPath} `, `(${proc.status})`);
    process.exit(1);
  } else {
    logOK(`[OK][${elapsed(fileStart)}] ${fullPath}`);
  }
}

async function runNext(next) {
  while (true) {
    const fullPath = next();
    if (!fullPath) {
      return;
    }
    await runTest(fullPath);
  }
}

async function runTests(dir) {
  const start = Date.now();
  const testFiles = fs.readdirSync(dir).filter((s) => s.endsWith('.test.mjs'));
  let i = 0;
  const next = () => {
    const filename = testFiles[i];
    if (!filename) {
      return;
    }
    ++i;
    return path.join(dir, filename);
  };
  const promises = new Array(numCpus).fill().map(() => runNext(next));
  await Promise.all(promises);

  logOK(`[DONE] ${elapsed(start)}`);
}

runTests('./src');
