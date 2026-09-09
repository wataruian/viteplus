import { initializeRum } from '@lightproject/common/utils';
import { ModeProvider, SessionProvider, ThemeProvider } from '@lightproject/design-system/context';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import packageJson from '../package.json' with { type: 'json' };

import 'virtual:uno.css';

const isPreviewRoute = globalThis.location.pathname === '/preview';

const Page = isPreviewRoute
  ? lazy(async () => await import('./preview-page'))
  : lazy(async () => await import('./app'));

initializeRum({
  serviceName: packageJson.name,
  serviceVersion: packageJson.version,
});

const container = globalThis.document.querySelector('#root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <SessionProvider>
        <ThemeProvider>
          <ModeProvider>
            <Suspense fallback={null}>
              <Page />
            </Suspense>
          </ModeProvider>
        </ThemeProvider>
      </SessionProvider>
    </StrictMode>,
  );
}
