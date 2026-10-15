import { describe, expect, test, vi } from 'vite-plus/test';

import { useClientId } from '../../src/context/client-id-context';
import { ClientIdProvider } from '../../src/context/client-id-provider';
import { useMode } from '../../src/context/mode-context';
import { ModeProvider } from '../../src/context/mode-provider';
import { useTheme } from '../../src/context/theme-context';
import { ThemeProvider } from '../../src/context/theme-provider';
import { themes } from '../../src/utils/theme-generator';
import { click, render, requireElement } from './helpers/render';

const ModeConsumer = () => {
  const { mode, toggleMode } = useMode();
  return (
    <div>
      <span>{mode}</span>
      <button onClick={toggleMode} type='button'>
        toggle
      </button>
    </div>
  );
};

const BareModeConsumer = () => {
  useMode();
  return null;
};

const ThemeConsumer = () => {
  const { setTheme, theme } = useTheme();
  return (
    <div>
      <span>{theme}</span>
      <button
        onClick={() => {
          setTheme('non-default-theme');
        }}
        type='button'
      >
        change
      </button>
    </div>
  );
};

const BareThemeConsumer = () => {
  useTheme();
  return null;
};

const ClientIdConsumer = () => {
  const { resetClientId, clientId } = useClientId();
  return (
    <div>
      <span>{clientId}</span>
      <button
        onClick={() => {
          resetClientId();
        }}
        type='button'
      >
        reset
      </button>
    </div>
  );
};

const BareClientIdConsumer = () => {
  useClientId();
  return null;
};

describe('ModeProvider / useMode', () => {
  test('defaults to dark mode and applies the class to documentElement', () => {
    const { container, unmount } = render(
      <ModeProvider>
        <ModeConsumer />
      </ModeProvider>,
    );

    expect(container.querySelector('span')?.textContent).toBe('dark');
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(true);

    unmount();
  });

  test('respects an explicit initialMode', () => {
    const { container, unmount } = render(
      <ModeProvider initialMode='light'>
        <ModeConsumer />
      </ModeProvider>,
    );

    expect(container.querySelector('span')?.textContent).toBe('light');
    expect(globalThis.document.documentElement.classList.contains('light')).toBe(true);

    unmount();
  });

  test('toggleMode flips between light and dark', () => {
    const { container, unmount } = render(
      <ModeProvider initialMode='light'>
        <ModeConsumer />
      </ModeProvider>,
    );

    const button = requireElement(container, 'button');

    click(button);
    expect(container.querySelector('span')?.textContent).toBe('dark');
    expect(globalThis.document.documentElement.classList.contains('dark')).toBe(true);

    click(button);
    expect(container.querySelector('span')?.textContent).toBe('light');

    unmount();
  });

  test('useMode throws when used outside a ModeProvider', () => {
    expect(() => {
      render(<BareModeConsumer />);
    }).toThrow(/useMode must be used within a ModeProvider/u);
  });
});

describe('ThemeProvider / useTheme', () => {
  test('defaults to the first theme in the registry', () => {
    const [firstTheme] = Object.keys(themes);
    const { container, unmount } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(container.querySelector('span')?.textContent).toBe(firstTheme);
    unmount();
  });

  test('setTheme updates the theme and the documentElement class', () => {
    const { container, unmount } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    click(requireElement(container, 'button'));

    expect(container.querySelector('span')?.textContent).toBe('non-default-theme');
    expect(globalThis.document.documentElement.classList.contains('non-default-theme')).toBe(true);

    unmount();
  });

  test('useTheme throws when used outside a ThemeProvider', () => {
    expect(() => {
      render(<BareThemeConsumer />);
    }).toThrow(/useTheme must be used within a ThemeProvider/u);
  });
});

const createSequentialIds = () => {
  let count = 0;
  return () => {
    count += 1;
    return `client-${count}`;
  };
};

describe('ClientIdProvider / useClientId', () => {
  test('provides the clientId made by createId', () => {
    const { container, unmount } = render(
      <ClientIdProvider createId={createSequentialIds()}>
        <ClientIdConsumer />
      </ClientIdProvider>,
    );

    expect(container.querySelector('span')?.textContent).toBe('client-1');
    unmount();
  });

  test('creates the clientId once per mount and keeps it across re-renders', () => {
    const createId = vi.fn(createSequentialIds());
    const tree = (
      <ClientIdProvider createId={createId}>
        <ClientIdConsumer />
      </ClientIdProvider>
    );
    const { container, rerender, unmount } = render(tree);

    rerender(tree);
    rerender(tree);

    expect(container.querySelector('span')?.textContent).toBe('client-1');
    expect(createId).toHaveBeenCalledOnce();
    unmount();
  });

  test('resetClientId stores a fresh id from createId', () => {
    const { container, unmount } = render(
      <ClientIdProvider createId={createSequentialIds()}>
        <ClientIdConsumer />
      </ClientIdProvider>,
    );

    click(requireElement(container, 'button'));

    expect(container.querySelector('span')?.textContent).toBe('client-2');
    unmount();
  });

  test('useClientId throws when used outside a ClientIdProvider', () => {
    expect(() => {
      render(<BareClientIdConsumer />);
    }).toThrow(/useClientId must be used within ClientIdProvider/u);
  });
});
