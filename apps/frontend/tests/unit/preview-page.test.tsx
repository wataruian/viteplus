import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test, vi } from 'vite-plus/test';

import PreviewPage from '../../src/preview-page';

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

  test('the mode switcher toggles light/dark in place without remounting the page', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const container = globalThis.document.createElement('div');
    globalThis.document.body.append(container);
    const root = createRoot(container);
    const html = globalThis.document.documentElement;

    act(() => {
      root.render(<PreviewPage />);
    });

    const clickSwitcher = (label: string) => {
      const button = container.querySelector(`button[aria-label="${label}"]`);
      expect(button).not.toBeNull();
      act(() => {
        button?.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true }));
      });
    };

    try {
      const switcher = container.querySelector('button[aria-label="Switch to light mode"]');
      expect(html.classList.contains('dark')).toBe(true);

      clickSwitcher('Switch to light mode');
      expect(html.classList.contains('light')).toBe(true);
      expect(html.classList.contains('dark')).toBe(false);
      expect(container.querySelector('button[aria-label="Switch to dark mode"]')).toBe(switcher);

      clickSwitcher('Switch to dark mode');
      expect(html.classList.contains('dark')).toBe(true);
      expect(container.querySelector('button[aria-label="Switch to light mode"]')).toBe(switcher);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      html.className = '';
      consoleErrorSpy.mockRestore();
    }
  });
});
