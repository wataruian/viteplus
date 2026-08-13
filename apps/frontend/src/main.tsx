import { initializeRum } from '@lightproject/common/utils';
import { SessionProvider } from '@lightproject/design-system/context';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import packageJson from '../package.json' with { type: 'json' };

import 'virtual:uno.css';

import App from './app.tsx';

initializeRum({
  serviceName: packageJson.name,
  serviceVersion: packageJson.version,
});

const container = globalThis.document.querySelector('#root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <SessionProvider>
        <App />
      </SessionProvider>
    </StrictMode>,
  );
}
