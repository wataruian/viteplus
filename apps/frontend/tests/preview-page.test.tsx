import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test, vi } from 'vite-plus/test';

import PreviewPage from '../src/preview-page';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('PreviewPage', () => {
  test('renders a Home button and the design system preview', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const container = globalThis.document.createElement('div');
    globalThis.document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(<PreviewPage />);
    });

    try {
      const homeLink = container.querySelector('a[href="/"]');
      expect(homeLink).not.toBeNull();
      expect(homeLink?.textContent).toContain('Home');
      expect(container.querySelector('.i-ph-house-bold')).not.toBeNull();

      expect(container.textContent).toContain('Design System');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      consoleErrorSpy.mockRestore();
    }
  });
});
