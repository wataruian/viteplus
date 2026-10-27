import { describe, expect, test, vi } from 'vite-plus/test';

import { Preview } from '../../src/components/preview';
import { render, withProviders } from './helpers/render';

describe('Preview', () => {
  test('renders the design system preview page with theme scales and component gallery', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(withProviders(<Preview />));

    expect(container.textContent).toContain('Design System');
    expect(container.textContent).toContain('Theme Color Scales');
    expect(container.textContent).toContain('Components');
    expect(container.querySelectorAll('section').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.i-ph-star-fill').length).toBeGreaterThan(0);

    unmount();
    consoleErrorSpy.mockRestore();
  });

  test('renders an extra "Default" group per component when showDefault is set', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(withProviders(<Preview showDefault />));

    expect(container.textContent).toContain('Default');

    unmount();
    consoleErrorSpy.mockRestore();
  });

  test('passes className through directly when useDefault is false', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(
      withProviders(<Preview className='bare-preview' useDefault={false} />),
    );

    const section = container.querySelector('section');
    expect(section?.className).toContain('bare-preview');

    unmount();
    consoleErrorSpy.mockRestore();
  });
});
