/**
 * This file contains logic for running functions on the primary thread. It
 * supports clustering and arbitrarily nested worker threads. The deeper
 * the worker nesting, the less efficient this is, however, as it must pass
 * messages and responses up and down the entire tree.
 */

import workers from 'worker_threads';
import cluster from 'cluster';

const msgType = '::sql3';

function idgen() {
  let id = 0;
  return () => ++id;
}

function isSql3Msg(msg) {
  return msg?.type === msgType;
}

function sendDown(worker, msg) {
  if (typeof worker === 'function') {
    return worker(msg);
  }
  if (worker.send) {
    return worker.send(msg);
  }
  return worker.postMessage(msg);
}

/**
 * A message pump. Incoming messages are run either locally (if on primary)
 * or remotely (if on secondaries or workers), and the result is then sent
 * to the receive which is either a local function, a cluster worker, or
 * a thread worker.
 */
export function messagePump(runner) {
  const nextId = idgen();
  const handlers = {};
  let sendUp;

  if (cluster.isPrimary && workers.isMainThread) {
    sendUp = (msg) => {
      const handler = handlers[msg.id];
      try {
        const payload = runner(msg.payload);
        handler({
          id: msg.id,
          type: msg.type,
          ok: true,
          payload,
        });
      } catch (payload) {
        handler({
          id: msg.id,
          type: msg.type,
          ok: false,
          payload: JSON.stringify({
            message: payload.message,
            stack: payload.stack,
          }),
        });
      }
    };
  } else if (!workers.isMainThread) {
    sendUp = (msg) => workers.parentPort.postMessage(msg);
  } else {
    sendUp = (msg) => process.send(msg);
  }

  const requestHandler = (worker, msg) => {
    if (!isSql3Msg(msg)) {
      return;
    }
    const id = nextId();
    const originalId = msg.id;
    msg.id = id;
    handlers[id] = (response) => {
      response.id = originalId;
      sendDown(worker, response);
    };
    sendUp(msg);
  };

  const responseHandler = (msg) => {
    if (!isSql3Msg(msg)) {
      return;
    }
    const cb = handlers[msg.id];
    if (!cb) {
      console.error(`No handler for message ${msg.id}`);
    }
    delete handlers[msg.id];
    cb(msg);
  };

  if (cluster.isPrimary && workers.isMainThread) {
    cluster.addListener('message', requestHandler);
  } else if (!workers.isMainThread) {
    workers.parentPort.on('message', responseHandler);
  } else {
    process.on('message', responseHandler);
  }

  return {
    addWorker(worker) {
      worker.on('message', (msg) => requestHandler(worker, msg));
      return worker;
    },
    send(payload) {
      return new Promise((ok, fail) => {
        const handleResponse = (r) => {
          if (r.ok) {
            ok(r.payload);
          } else {
            fail(JSON.parse(r.payload));
          }
        };
        requestHandler(handleResponse, { type: msgType, payload });
      });
    },
  };
}

/**
 * Returns a builder which converts a plain function into a function which
 * is serialized and sent to the primary process for execution.
 */
function evalRunner(runner) {
  const evalCache = {};

  return ({ fn, args }) => {
    let f = evalCache[fn];
    if (!f) {
      f = eval(`(() => ${fn})()`);
      evalCache[fn] = f;
    }
    return runner(f, args);
  };
}

/**
 * Creates a mechanism for sending functions to the primary thread for
 * execution. Supports workers and clusters.
 */
export function primaryFn(runner) {
  const pump = messagePump(evalRunner(runner));

  return {
    /**
     * Add a worker thread to the primary function system. This proxies the
     * thread through secondary cluster workers, if necessary, ensuring that
     * worker messages get handled by the primary regardless of who spawned
     * the worker.
     */
    addWorker: pump.addWorker,

    /**
     * Send a message { fn, args }.
     */
    send: pump.send,
  };
}
