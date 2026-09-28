import { act } from 'react';
import { type ThemeVars, themes } from 'storybook/theming';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { modeChangedEvent, modeStorageKey } from '../../.storybook/mode-channel';
import { render, requireElement } from './helpers/render';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: query.includes('dark'), media: query }),
  });
});

type Listener = (payload: string) => void;

const channel = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    emit: (event: string, payload: string) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
    listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    off: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    },
    on: (event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
    },
  };
});

vi.mock('storybook/preview-api', () => ({ addons: { getChannel: () => channel } }));

const { CustomDocsContainer, ModeFrame, withDocsMode } = await import('../../.storybook/mode');

const emitMode = (mode: string) => {
  act(() => {
    channel.emit(modeChangedEvent, mode);
  });
};

const FakeDocsContainer = ({ label, theme }: { label: string; theme?: ThemeVars }) => (
  <div
    className='docs-container'
    data-theme-base={theme?.base}
    data-theme-is-dark={String(theme === themes.dark)}
  >
    {label}
  </div>
);

const DocsPage = withDocsMode(FakeDocsContainer);

const requireHtmlElement = (container: ParentNode, selector: string): HTMLElement => {
  const element = container.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Element not found for selector: ${selector}`);
  }
  return element;
};

afterEach(() => {
  globalThis.localStorage.clear();
  globalThis.document.documentElement.className = '';
});

describe('Storybook theme objects', () => {
  test('themes.light and themes.dark are fixed light/dark themes', () => {
    expect(themes.light.base).toBe('light');
    expect(themes.dark.base).toBe('dark');
    expect(themes.normal.base).toBe('dark');
  });
});

describe('ModeFrame (story/variant pages)', () => {
  test('starts from the persisted mode and wraps stories in the neutral surface', () => {
    globalThis.localStorage.setItem(modeStorageKey, 'light');
    const { container, unmount } = render(
      <ModeFrame>
        <span className='story'>story</span>
      </ModeFrame>,
    );

    const frame = requireElement(container, 'div');
    expect(frame.className).toContain('bg-adaptive-surface');
    expect(frame.className).toContain('text-inverse-surface');
    expect(globalThis.document.documentElement.classList.contains('light')).toBe(true);

    unmount();
  });

  test('toggles light/dark in place without remounting the story', () => {
    const { container, unmount } = render(
      <ModeFrame>
        <span className='story'>story</span>
      </ModeFrame>,
    );
    const story = requireElement(container, '.story');
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(true);

    emitMode('light');
    expect(globalThis.document.documentElement.classList.contains('light')).toBe(true);
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(false);
    expect(requireElement(container, '.story')).toBe(story);

    emitMode('dark');
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(true);
    expect(requireElement(container, '.story')).toBe(story);

    unmount();
  });

  test('ignores payloads that are not a mode', () => {
    const { unmount } = render(
      <ModeFrame>
        <span />
      </ModeFrame>,
    );

    emitMode('sepia');
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(true);

    unmount();
  });

  test('unsubscribes from the channel on unmount', () => {
    const { unmount } = render(
      <ModeFrame>
        <span />
      </ModeFrame>,
    );
    expect(channel.listenerCount(modeChangedEvent)).toBe(1);

    unmount();
    expect(channel.listenerCount(modeChangedEvent)).toBe(0);
  });
});

describe('withDocsMode (docs pages)', () => {
  test("CustomDocsContainer wraps addon-docs' DocsContainer", () => {
    expect(typeof CustomDocsContainer).toBe('function');
  });

  test('switches the docs theme in place without remounting the docs page', () => {
    const { container, unmount } = render(<DocsPage label='docs' />);
    const wrapper = requireHtmlElement(container, 'div');
    const docs = requireHtmlElement(container, '.docs-container');

    expect(wrapper.className).toBe('dark');
    expect(docs.dataset['themeBase']).toBe('dark');
    expect(docs.dataset['themeIsDark']).toBe('true');
    expect(docs.textContent).toBe('docs');

    emitMode('light');
    expect(wrapper.className).toBe('light');
    expect(docs.dataset['themeBase']).toBe('light');
    expect(docs.dataset['themeIsDark']).toBe('false');
    expect(requireHtmlElement(container, '.docs-container')).toBe(docs);

    emitMode('dark');
    expect(wrapper.className).toBe('dark');
    expect(requireHtmlElement(container, '.docs-container')).toBe(docs);

    unmount();
  });
});
