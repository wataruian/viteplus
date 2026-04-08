import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { getSlotClass } from '../utils/styles';
import { themes } from '../utils/theme-generator';

export interface ThemeSwitcherProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  themeWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  themeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement> | undefined;
  modeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement> | undefined;
  modeIconProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const defaultInternalClasses = {
  modeAriaLabel: 'Toggle Dark/Light Mode',
  modeButton:
    'flex items-center justify-center p-2 rounded-full border border-black/20 dark:border-white/20 transition-all active:scale-90',
  modeIconDark: 'i-ph-moon-fill w-5 h-5 text-blue-400',
  modeIconLight: 'i-ph-sun-dim-fill w-5 h-5 text-amber-500',
  themeButton:
    'px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full transition-all',
  themeWrapper: 'flex items-center gap-2 p-1 rounded-full border backdrop-blur-sm',
};

export const defaultClasses = 'flex items-center gap-4';

export const ThemeSwitcher = ({
  className = '',
  useDefault = true,
  children,
  themeWrapperProps,
  themeButtonProps,
  modeButtonProps,
  modeIconProps,
  props: rootProps,
}: ThemeSwitcherProps) => {
  const availableThemes = Object.entries(themes).map(([key]) => ({
    class: key === 'default' ? '' : key,
    id: key,
    name: key.toUpperCase(),
  }));

  const [currentTheme, setCurrentTheme] = useState('default');
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = globalThis.localStorage.getItem('theme') ?? 'default';
    const rawMode = globalThis.localStorage.getItem('mode');
    const savedMode = rawMode === 'light' || rawMode === 'dark' ? rawMode : 'dark';

    setCurrentTheme(savedTheme);
    setMode(savedMode);
  }, []);

  useEffect(() => {
    const htmlElement = globalThis.document.documentElement;
    for (const themeItem of availableThemes) {
      if (themeItem.class !== '') {
        htmlElement.classList.remove(themeItem.class);
      }
    }

    const activeTheme = availableThemes.find((themeItem) => themeItem.id === currentTheme);
    if (activeTheme !== undefined && activeTheme.class !== '') {
      htmlElement.classList.add(activeTheme.class);
    }
    globalThis.localStorage.setItem('theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const htmlElement = globalThis.document.documentElement;
    htmlElement.classList.toggle('light', mode === 'light');
    htmlElement.classList.toggle('dark', mode === 'dark');
    globalThis.localStorage.setItem('mode', mode);
  }, [mode]);

  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <div
            {...themeWrapperProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.themeWrapper,
              themeWrapperProps,
            )}
          >
            {availableThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => {
                  setCurrentTheme(theme.id);
                }}
                {...themeButtonProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.themeButton,
                  themeButtonProps,
                )}
              >
                {theme.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setMode(mode === 'dark' ? 'light' : 'dark');
            }}
            {...modeButtonProps}
            className={getSlotClass(useDefault, defaultInternalClasses.modeButton, modeButtonProps)}
            aria-label={defaultInternalClasses.modeAriaLabel}
          >
            <div
              {...modeIconProps}
              className={getSlotClass(
                useDefault,
                mode === 'dark'
                  ? defaultInternalClasses.modeIconDark
                  : defaultInternalClasses.modeIconLight,
                modeIconProps,
              )}
            />
          </button>
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
};
