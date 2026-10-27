import { z } from 'zod';

import { UnrecoverableJobError, defineFunction } from '../../../src/core/function';

const schema = z.object({
  mode: z.enum([
    'ok',
    'fail',
    'hang',
    'crash',
    'cooperative',
    'skip',
    'stray',
    'ignore',
    'unrecoverable',
    'exit-on-abort',
  ]),
});

const threadTest = defineFunction({
  handler: async ({ mode }, { signal, skip }) => {
    await Promise.resolve();
    if (mode === 'skip') {
      skip('nothing to do');
      return;
    }
    if (mode === 'unrecoverable') {
      throw new UnrecoverableJobError('cannot succeed');
    }
    if (mode === 'fail') {
      throw new Error('handler failed');
    }
    if (mode === 'stray') {
      globalThis.setTimeout(() => {
        throw new Error('stray failure');
      }, 10);
      return;
    }
    if (mode === 'crash') {
      globalThis.process.exit(3);
    }
    if (mode === 'hang') {
      for (;;) {
        // spin
      }
    }
    if (mode === 'ignore') {
      await new Promise(() => {});
    }
    if (mode === 'exit-on-abort') {
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve);
      });
      globalThis.process.exit(4);
    }
    if (mode === 'cooperative') {
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve);
      });
    }
  },
  name: 'thread-test',
  schema,
});

export { threadTest };
