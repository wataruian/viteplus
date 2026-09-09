import { forwardRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as RegistryModule from '../src/components/registry';
import { render } from './helpers/render';

beforeEach(() => {
  vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock('../src/components/registry');
  vi.resetModules();
  vi.restoreAllMocks();
});

const importPreview = async () => {
  const { Preview } = await import('../src/components/preview');
  return Preview;
};

describe('Preview when the component registry drifts from its *Styles entries', () => {
  test('skips a *Styles entry that has no matching component', async () => {
    vi.doMock('../src/components/registry', async (importOriginal) => {
      const original = await importOriginal<typeof RegistryModule>();
      return { ...original, ghostStyles: { base: '', default: {}, variants: {} } };
    });

    const Preview = await importPreview();
    const { container, unmount } = render(<Preview />);

    expect(container.textContent).toContain('Design System');
    expect(container.textContent).not.toContain('Ghost');

    unmount();
  });

  test('renders a component whose *Styles value is not a record with no variant groups or default detail', async () => {
    const FakeWidget = forwardRef<HTMLDivElement, Record<string, unknown>>((_props, ref) => (
      <div ref={ref}>widget</div>
    ));
    FakeWidget.displayName = 'Widget';

    vi.doMock('../src/components/registry', async (importOriginal) => {
      const original = await importOriginal<typeof RegistryModule>();
      return { ...original, Widget: FakeWidget, widgetStyles: 'not-a-record' };
    });

    const Preview = await importPreview();
    const { container, unmount } = render(<Preview showDefault />);

    const widgetHeading = [...container.querySelectorAll('h2')].find(
      (heading) => heading.textContent === 'Widget',
    );
    const widgetCard = widgetHeading?.parentElement;

    expect(widgetCard?.textContent).toContain('Default');
    expect(widgetCard?.textContent).not.toContain('Default (');

    unmount();
  });

  test('renders a plain "Default" label when a *Styles value has no default entry', async () => {
    const FakeWidget = forwardRef<HTMLDivElement, Record<string, unknown>>((_props, ref) => (
      <div ref={ref}>widget</div>
    ));
    FakeWidget.displayName = 'Widget';

    vi.doMock('../src/components/registry', async (importOriginal) => {
      const original = await importOriginal<typeof RegistryModule>();
      return { ...original, Widget: FakeWidget, widgetStyles: { base: '', variants: {} } };
    });

    const Preview = await importPreview();
    const { container, unmount } = render(<Preview showDefault />);

    const widgetHeading = [...container.querySelectorAll('h2')].find(
      (heading) => heading.textContent === 'Widget',
    );
    const widgetCard = widgetHeading?.parentElement;

    expect(widgetCard?.textContent).toContain('Default');
    expect(widgetCard?.textContent).not.toContain('Default (');

    unmount();
  });
});
