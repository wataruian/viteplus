import { parentPort } from 'node:worker_threads';

import { serveThread } from '../../../src/runtimes/thread';
import { threadTest } from './thread-functions';

if (parentPort) {
  serveThread(parentPort, [threadTest], () => {
    globalThis.process.exit(0);
  });
}
