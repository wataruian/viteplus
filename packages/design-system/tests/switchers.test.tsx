import { describe, expect, test } from 'vite-plus/test';

import { ModeSwitcher } from '../src/components/mode-switcher';
import { ThemeSwitcher } from '../src/components/theme-switcher';
import { ModeProvider } from '../src/context/mode-provider';
import { ThemeProvider } from '../src/context/theme-provider';
import { themes } from '../src/utils/theme-generator';
import { click, render, requireElement } from './render';

describe('ModeSwitcher', () => {
  test('toggles mode when clicked and updates its aria-label', () => {
    const { container, unmount } = render(
      <ModeProvider initialMode='light'>
        <ModeSwitcher />
      </ModeProvider>,
    );

    const button = requireElement(container, 'button');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');

    click(button);
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');

    unmount();
  });
});

describe('ThemeSwitcher', () => {
  test('renders one button per theme and switches the active theme on click', () => {
    const themeList = Object.keys(themes);
    const { container, unmount } = render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(themeList.length);
    expect([...buttons].map((button) => button.textContent)).toStrictEqual(themeList);

    const lastTheme = themeList.at(-1);
    const lastButton = [...buttons].find((button) => button.textContent === lastTheme);
    expect(lastButton).toBeDefined();

    if (lastButton) {
      click(lastButton);
    }

    expect(globalThis.document.documentElement.classList.contains(lastTheme ?? '')).toBe(
      lastTheme !== 'default',
    );

    unmount();
  });
});
