import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { modeChangedEvent, modeStorageKey } from '../../.storybook/mode-channel';
import { click, render, requireElement } from './helpers/render';

interface RegisteredAddon {
  match: () => boolean;
  render: () => ReactNode;
  title: string;
  type: string;
}

const manager = vi.hoisted(() => ({
  added: new Map<string, RegisteredAddon>(),
  emit: vi.fn<(event: string, payload: string) => void>(),
  registered: [] as string[],
}));

vi.mock('storybook/manager-api', () => ({
  addons: {
    add: (id: string, addon: RegisteredAddon) => {
      manager.added.set(id, addon);
    },
    register: (id: string, callback: () => void) => {
      manager.registered.push(id);
      callback();
    },
  },
  types: { TOOL: 'tool' },
  useStorybookApi: () => ({ emit: manager.emit }),
}));

vi.mock('storybook/internal/components', () => ({
  IconButton: ({
    children,
    onClick,
    title,
  }: {
    children: ReactNode;
    onClick: () => void;
    title: string;
  }) => (
    <button onClick={onClick} title={title} type='button'>
      {children}
    </button>
  ),
}));

const { ModeTool } = await import('../../.storybook/manager');

afterEach(() => {
  manager.emit.mockClear();
  globalThis.localStorage.clear();
});

describe('manager mode tool', () => {
  test('registers itself as a toolbar tool shown on every view', () => {
    expect(manager.registered).toContain('lightproject/mode');

    const tool = manager.added.get('lightproject/mode/tool');
    expect(tool?.type).toBe('tool');
    expect(tool?.title).toBe('Mode');
    expect(tool?.match()).toBe(true);
    expect(tool?.render).toBe(ModeTool);
  });

  test('toggles the mode, persists it, and broadcasts it to the preview', () => {
    const { container, unmount } = render(<ModeTool />);
    const button = requireElement(container, 'button');
    expect(button.textContent).toBe('☾ Dark');
    expect(button.getAttribute('title')).toBe('Switch to light mode');

    click(button);
    expect(button.textContent).toBe('☀ Light');
    expect(manager.emit).toHaveBeenLastCalledWith(modeChangedEvent, 'light');
    expect(globalThis.localStorage.getItem(modeStorageKey)).toBe('light');

    click(button);
    expect(button.textContent).toBe('☾ Dark');
    expect(manager.emit).toHaveBeenLastCalledWith(modeChangedEvent, 'dark');
    expect(globalThis.localStorage.getItem(modeStorageKey)).toBe('dark');

    unmount();
  });

  test('starts from the persisted mode', () => {
    globalThis.localStorage.setItem(modeStorageKey, 'light');
    const { container, unmount } = render(<ModeTool />);

    expect(requireElement(container, 'button').textContent).toBe('☀ Light');

    unmount();
  });
});
