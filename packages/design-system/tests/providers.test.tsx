import { describe, expect, test } from 'vite-plus/test';

import { useMode } from '../src/context/mode-context';
import { ModeProvider } from '../src/context/mode-provider';
import { useSession } from '../src/context/session-context';
import { SessionProvider } from '../src/context/session-provider';
import { useTheme } from '../src/context/theme-context';
import { ThemeProvider } from '../src/context/theme-provider';
import { themes } from '../src/utils/theme-generator';
import { click, render, requireElement } from './render';

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

const SessionConsumer = () => {
  const { resetSessionId, sessionId } = useSession();
  return (
    <div>
      <span>{sessionId}</span>
      <button
        onClick={() => {
          resetSessionId();
        }}
        type='button'
      >
        reset
      </button>
    </div>
  );
};

const BareSessionConsumer = () => {
  useSession();
  return null;
};

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

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

describe('SessionProvider / useSession', () => {
  test('provides a valid UUID sessionId', () => {
    const { container, unmount } = render(
      <SessionProvider>
        <SessionConsumer />
      </SessionProvider>,
    );

    expect(container.querySelector('span')?.textContent).toMatch(uuidPattern);
    unmount();
  });

  test('resetSessionId generates and stores a new UUID', () => {
    const { container, unmount } = render(
      <SessionProvider>
        <SessionConsumer />
      </SessionProvider>,
    );

    const originalId = container.querySelector('span')?.textContent;
    click(requireElement(container, 'button'));

    const newId = container.querySelector('span')?.textContent;
    expect(newId).toMatch(uuidPattern);
    expect(newId).not.toBe(originalId);

    unmount();
  });

  test('useSession throws when used outside a SessionProvider', () => {
    expect(() => {
      render(<BareSessionConsumer />);
    }).toThrow(/useSession must be used within SessionProvider/u);
  });
});
