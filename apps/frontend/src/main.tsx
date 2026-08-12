import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'virtual:uno.css';
import App from './app.tsx';

const container = globalThis.document.querySelector('#root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
