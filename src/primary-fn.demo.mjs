/**
 * This is just a hacky demo of the primary fn logic. It tests the major
 * scenarios: cluster mode, thread workers, etc.
 */
import { fileURLToPath } from 'url';
import workers from 'worker_threads';
import cluster from 'cluster';
import { primaryFn } from './primary-fn.mjs';

const primary = primaryFn((fn, args) => fn(...args));

const sum = primary.mkfn((a, b) => a + b);

const mul = primary.mkfn((a, b) => a * b);

const log = (promise) => promise.then(console.log);

const __filename = fileURLToPath(import.meta.url);

const workerSum = (a, b) =>
  primary.addWorker(
    new workers.Worker(__filename, {
      workerData: { args: [a, b] },
    })
  );

const runPrimary = () => {
  log(sum(1, 1));
  workerSum(2, 2);
  cluster.fork();
};

const runWorkerThread = () => {
  log(sum(...workers.workerData.args)).then(() => process.exit());
};

const runSecondary = () => {
  let count = 2;

  const deref = () => {
    if (--count <= 0) {
      process.exit();
    }
  };

  workerSum(8, 8).on('exit', deref);
  log(mul(2, 4)).then(deref);
};

if (cluster.isPrimary && workers.isMainThread) {
  runPrimary();
} else if (!workers.isMainThread) {
  runWorkerThread();
} else {
  runSecondary();
}
