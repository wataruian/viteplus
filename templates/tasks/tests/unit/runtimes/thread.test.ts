import { describe, expect, test } from 'vite-plus/test';

import { type MessagePortLike, serveThread } from '../../../src/runtimes/thread';
import type { ThreadReady, ThreadResponse } from '../../../src/runtimes/thread-protocol';
import { testFunction } from '../helpers/jobs';

const createPort = () => {
  const posted: (ThreadReady | ThreadResponse)[] = [];
  let listener: ((event: MessageEvent) => void) | undefined = undefined;
  const port: MessagePortLike = {
    addEventListener: (_type, handle) => {
      listener = handle;
    },
    postMessage: (message) => {
      posted.push(message);
    },
  };
  const send = (data: unknown) => {
    listener?.(new globalThis.MessageEvent('message', { data }));
  };
  return { port, posted, send };
};

describe('serveThread', () => {
  test('announces it is ready once it listens', () => {
    const { port, posted } = createPort();
    serveThread(port, [testFunction()], () => {});

    expect(posted).toStrictEqual([{ type: 'ready' }]);
  });

  test('answers an invalid job with an unrecoverable error instead of crashing', () => {
    const { port, posted, send } = createPort();
    serveThread(port, [testFunction()], () => {});

    send({ job: { id: 'job-1' }, traceContext: {}, type: 'run' });
    send({ type: 'nonsense' });

    expect(posted).toHaveLength(2);
    expect(posted[0]).toStrictEqual({ type: 'ready' });
    expect(posted[1]).toMatchObject({ jobId: 'job-1', unrecoverable: true });
    expect(posted[1]).toHaveProperty('error', expect.stringMatching(/^Invalid job: /u));
  });
});
