import { commonEnv } from '@lightproject/common/environment';
import { logger, setClientId, startRequestScope } from '@lightproject/common/logger';
import { recordGaugeWithExemplar } from '@lightproject/common/utils';
import { useClientId } from '@lightproject/design-system/context';
import { useEffect, useState } from 'react';

import heroImg from './assets/hero.png';
import typescriptLogo from './assets/typescript.svg';
import viteLogo from './assets/vite.svg';
import { config } from './config';
import { counterRef } from './counter';
import { trpcClient } from './providers/trpc-provider';

import './style.css';

type RequestScope = ReturnType<typeof startRequestScope>;

interface TrpcCall {
  call: () => Promise<unknown>;
  method: string;
  resultMessage: string;
}

const trpcCalls = {
  createUser: {
    call: async () => await trpcClient.test.createUser.mutate({}),
    method: 'test.createUser',
    resultMessage: 'Created a random user',
  },
  enqueuePing: {
    call: async () =>
      await trpcClient.test.enqueuePing.mutate({ message: 'Hello from the frontend' }),
    method: 'test.enqueuePing',
    resultMessage: 'Enqueued a ping job',
  },
  sample: {
    call: async () => await trpcClient.test.hello.query({ name: 'Test' }),
    method: 'test.hello',
    resultMessage: 'tRPC Sample Result',
  },
} satisfies Record<string, TrpcCall>;

const callTrpc = async (scope: RequestScope, { call, method, resultMessage }: TrpcCall) => {
  const { span } = scope;
  const trpcCallStart = globalThis.performance.now();
  let trpcCallSucceeded = true;

  try {
    span.addEvent(`Executing tRPC ${method}`);

    const result = await scope.run(call);

    span.setAttribute('trpc.test.success', true);

    scope.run(() => {
      logger.info(resultMessage, {
        result,
      });
    });
  } catch (error: unknown) {
    trpcCallSucceeded = false;
    span.recordException(error instanceof Error ? error : String(error));
    span.setAttribute('trpc.test.success', false);

    scope.run(() => {
      logger.error('Failed to call tRPC server', {
        error,
        method,
      });
    });
  }

  scope.run(() => {
    recordGaugeWithExemplar({
      attributes: { 'rpc.method': method, 'rpc.success': trpcCallSucceeded },
      description: 'Duration of the most recently completed tRPC client call',
      name: 'http_client_duration_seconds',
      unit: 's',
      value: (globalThis.performance.now() - trpcCallStart) / 1000,
    }).catch(() => {
      // Skip exemplar metric if it fails
    });
  });
};

const callTrpcSample = async (scope: RequestScope): Promise<void> => {
  await callTrpc(scope, trpcCalls.sample);
};

const runTrpcCall = async (spanName: string, trpcCall: TrpcCall): Promise<void> => {
  const scope = startRequestScope(spanName, { root: true });
  try {
    await callTrpc(scope, trpcCall);
  } finally {
    scope.span.end();
  }
};

const runTrpcSample = async (): Promise<void> => {
  await runTrpcCall('trpc.sample', trpcCalls.sample);
};

const usePendingAction = (run: () => Promise<void>): [boolean, () => void] => {
  const [isPending, setIsPending] = useState(false);

  const start = (): void => {
    setIsPending(true);

    run()
      .catch(() => {
        // Errors already logged and recorded in span
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  return [isPending, start];
};

const App = () => {
  const { clientId } = useClientId();
  const [isTrpcSamplePending, handleTrpcSampleClick] = usePendingAction(runTrpcSample);
  const [isEnqueuePingPending, handleEnqueuePingClick] = usePendingAction(async () => {
    await runTrpcCall('trpc.enqueue_ping', trpcCalls.enqueuePing);
  });
  const [isCreateUserPending, handleCreateUserClick] = usePendingAction(async () => {
    await runTrpcCall('trpc.create_user', trpcCalls.createUser);
  });

  useEffect(() => {
    setClientId(clientId);
    return () => {
      setClientId(undefined);
    };
  }, [clientId]);

  useEffect(() => {
    const run = async () => {
      const scope = startRequestScope('app.initialize', { root: true });
      const { span } = scope;

      try {
        await callTrpcSample(scope);

        scope.run(() => {
          const url = commonEnv.BACKEND_URL;
          if (url === undefined) {
            logger.info(`BACKEND_URL is not set, using default URL: ${config.backendUrl}`);
          } else {
            logger.info(`BACKEND_URL is set: ${url}`);
          }

          logger.info('Frontend Start', {
            platform: globalThis.navigator.userAgent,
            timestamp: new Date().toISOString(),
          });
        });

        span.setAttribute('app.initialized', true);
      } catch (error: unknown) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setAttribute('app.initialized', false);

        scope.run(() => {
          logger.error('Failed to initialize frontend', { error });
        });
      } finally {
        span.end();
      }
    };

    run().catch(() => {
      // Errors already logged and recorded in span
    });
  }, []);

  return (
    <>
      <section id='center'>
        <div className='hero'>
          <img src={heroImg} className='base' width='170' height='179' alt='' />
          <img src={typescriptLogo} className='framework' alt='TypeScript logo' />
          <img src={viteLogo} className='vite' alt='Vite logo' />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/app.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button ref={counterRef} id='counter' type='button' className='counter'></button>
        <button
          id='trpc-sample'
          type='button'
          className='counter'
          disabled={isTrpcSamplePending}
          onClick={handleTrpcSampleClick}
        >
          {isTrpcSamplePending ? 'Calling tRPC…' : 'Call tRPC sample'}
        </button>
        <button
          id='trpc-enqueue-ping'
          type='button'
          className='counter'
          disabled={isEnqueuePingPending}
          onClick={handleEnqueuePingClick}
        >
          {isEnqueuePingPending ? 'Enqueuing ping…' : 'Enqueue ping job'}
        </button>
        <button
          id='trpc-create-user'
          type='button'
          className='counter'
          disabled={isCreateUserPending}
          onClick={handleCreateUserClick}
        >
          {isCreateUserPending ? 'Adding user…' : 'Add random user'}
        </button>
        <a href='/preview' className='preview-link'>
          Preview Design System
        </a>
      </section>

      <div className='ticks'></div>

      <section id='next-steps'>
        <div id='docs'>
          <svg className='icon' role='presentation' aria-hidden='true'>
            <use href='/icons.svg#documentation-icon'></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href='https://vite.dev/' target='_blank' rel='noreferrer'>
                <img className='logo' src={viteLogo} alt='' /> Explore Vite
              </a>
            </li>
            <li>
              <a href='https://www.typescriptlang.org' target='_blank' rel='noreferrer'>
                <img className='button-icon' src={typescriptLogo} alt='' /> Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id='social'>
          <svg className='icon' role='presentation' aria-hidden='true'>
            <use href='/icons.svg#social-icon'></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href='https://github.com/vitejs/vite' target='_blank' rel='noreferrer'>
                <svg className='button-icon' role='presentation' aria-hidden='true'>
                  <use href='/icons.svg#github-icon'></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href='https://chat.vite.dev/' target='_blank' rel='noreferrer'>
                <svg className='button-icon' role='presentation' aria-hidden='true'>
                  <use href='/icons.svg#discord-icon'></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href='https://x.com/vite_js' target='_blank' rel='noreferrer'>
                <svg className='button-icon' role='presentation' aria-hidden='true'>
                  <use href='/icons.svg#x-icon'></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href='https://bsky.app/profile/vite.dev' target='_blank' rel='noreferrer'>
                <svg className='button-icon' role='presentation' aria-hidden='true'>
                  <use href='/icons.svg#bluesky-icon'></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className='ticks'></div>
      <section id='spacer'></section>
    </>
  );
};

export { callTrpc, callTrpcSample, runTrpcCall, runTrpcSample, trpcCalls, usePendingAction };
export type { RequestScope, TrpcCall };

export default App;
