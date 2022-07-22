/**
 * This is just a hacky demo of the primary fn logic. It tests the major
 * scenarios: cluster mode, thread workers, etc.
 */

import * as assert from 'assert';
import { fileURLToPath } from 'url';
import workers from 'worker_threads';
import cluster from 'cluster';
import { primaryFn } from './primary-fn.mjs';

const primary = primaryFn((fn, args) => fn(...args));

const mkfn =
  (fn) =>
  (...args) =>
    primary.send({ fn: fn.toString(), args });

const sum = mkfn((a, b) => a + b);

const mul = mkfn((a, b) => a * b);

const expect = (promise, expected) =>
  promise.then((actual) => {
    console.log(actual);
    assert.equal(actual, expected);
  });

const __filename = fileURLToPath(import.meta.url);

const workerSum = (a, b) =>
  primary.addWorker(
    new workers.Worker(__filename, {
      workerData: { args: [a, b], expected: a + b },
    })
  );

const runPrimary = () => {
  expect(sum(1, 1), 2);
  workerSum(2, 2);
  const worker = cluster.fork();
  worker.on('exit', (exitCode) => {
    if (exitCode) {
      process.exit(exitCode);
    }
  });
};

const runWorkerThread = async () => {
  try {
    await expect(sum(...workers.workerData.args), workers.workerData.expected);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

const runSecondary = () => {
  let count = 2;

  const deref = (exitCode) => {
    if (exitCode) {
      process.exit(exitCode);
    } else if (--count <= 0) {
      process.exit();
    }
  };

  workerSum(8, 8).on('exit', deref);
  expect(mul(2, 4), 8).then(deref);
};

if (cluster.isPrimary && workers.isMainThread) {
  runPrimary();
} else if (!workers.isMainThread) {
  runWorkerThread();
} else {
  runSecondary();
}
