import { logger, setSessionId, startSpanWithSession } from '@lightproject/common/logger';
import { recordGaugeWithExemplar } from '@lightproject/common/server';
import { runWithSpan } from '@lightproject/common/utils';
import { useSession } from '@lightproject/design-system/context';
import { type RefCallback, useEffect, useRef } from 'react';

import heroImg from './assets/hero.png';
import typescriptLogo from './assets/typescript.svg';
import viteLogo from './assets/vite.svg';
import { config, get } from './config';
import { setupCounter } from './counter';
import { trpcClient } from './providers/trpc-provider';

import './style.css';

const App = () => {
  const { sessionId } = useSession();
  const counterCleanupRef = useRef<(() => void) | undefined>(undefined);

  const counterRef: RefCallback<HTMLButtonElement> = (element) => {
    if (element) {
      counterCleanupRef.current = setupCounter(element);
    } else {
      counterCleanupRef.current?.();
      counterCleanupRef.current = undefined;
    }
  };

  useEffect(() => {
    setSessionId(sessionId);
    return () => {
      setSessionId(undefined);
    };
  }, [sessionId]);

  useEffect(() => {
    const run = async () => {
      const span = startSpanWithSession('app.initialize', { root: true });

      try {
        const trpcCallStart = globalThis.performance.now();
        let trpcCallSucceeded = true;

        try {
          span.addEvent('Executing tRPC test mutation');

          const result = await trpcClient.test.hello.query({ name: 'Test' });

          span.setAttribute('trpc.test.success', true);

          runWithSpan(span, () => {
            logger.info('tRPC Sample Result', {
              result,
            });
          });
        } catch (error: unknown) {
          trpcCallSucceeded = false;
          span.recordException(error instanceof Error ? error : String(error));
          span.setAttribute('trpc.test.success', false);

          runWithSpan(span, () => {
            logger.error('Failed to call tRPC server', {
              error,
            });
          });
        }

        runWithSpan(span, () => {
          recordGaugeWithExemplar({
            attributes: { 'rpc.method': 'test.hello', 'rpc.success': trpcCallSucceeded },
            description: 'Duration of the most recently completed tRPC client call',
            name: 'http_client_duration_seconds',
            unit: 's',
            value: (globalThis.performance.now() - trpcCallStart) / 1000,
          }).catch(() => {
            // Skip exemplar metric if it fails
          });
        });

        runWithSpan(span, () => {
          const url = get('API_URL') ?? get('VITE_API_URL');
          if (url !== undefined && url !== '') {
            logger.info(`VITE_API_URL is set: ${url}`);
          } else {
            logger.info(`VITE_API_URL is not set, using default URL: ${config.viteApiUrl}`);
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

        runWithSpan(span, () => {
          logger.error('Failed to initialize frontend', { error });
        });
      } finally {
        span.end();
      }
    };

    run().catch(() => {
      // Errors already logged and recorded in span
    });
  }, [sessionId]);

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

export default App;
