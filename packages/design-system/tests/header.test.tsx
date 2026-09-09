import type { ReactNode } from 'react';
import { describe, expect, test } from 'vite-plus/test';

import { Header } from '../src/components/header';
import { ModeProvider } from '../src/context/mode-provider';
import { ThemeProvider } from '../src/context/theme-provider';
import { themes } from '../src/utils/theme-generator';
import { render } from './helpers/render';

const withProviders = (children: ReactNode) => (
  <ThemeProvider>
    <ModeProvider>{children}</ModeProvider>
  </ThemeProvider>
);

const expectedButtonCount = Object.keys(themes).length + 1;

describe('Header', () => {
  test('renders a logo and both switchers by default', () => {
    const { container, unmount } = render(withProviders(<Header />));

    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(expectedButtonCount);

    unmount();
  });

  test('hides the switchers when their show* props are false', () => {
    const { container, unmount } = render(
      withProviders(<Header showLogo={false} showModeSwitcher={false} showThemeSwitcher={false} />),
    );

    expect(container.querySelectorAll('button')).toHaveLength(0);

    unmount();
  });

  test('uses className directly when useDefault is false', () => {
    const { container, unmount } = render(
      withProviders(
        <Header
          className='bare'
          showLogo={false}
          showModeSwitcher={false}
          showThemeSwitcher={false}
          useDefault={false}
        />,
      ),
    );

    expect(container.querySelector('header')?.className).toBe('bare');

    unmount();
  });

  test('renders children inside the header', () => {
    const { container, unmount } = render(
      withProviders(
        <Header showLogo={false} showModeSwitcher={false} showThemeSwitcher={false}>
          <nav>links</nav>
        </Header>,
      ),
    );

    expect(container.querySelector('nav')?.textContent).toBe('links');

    unmount();
  });
});
