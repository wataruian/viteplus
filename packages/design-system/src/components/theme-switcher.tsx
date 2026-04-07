import { useEffect, useState } from 'react';
import { themes } from '../utils/theme-generator';

export const ThemeSwitcher = () => {
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

  return (
    <div className='flex items-center gap-4'>
      <div className='flex items-center gap-2 p-1 bg-adaptive-surface/5 rounded-full border border-adaptive-surface/10 backdrop-blur-sm'>
        {availableThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => {
              setCurrentTheme(theme.id);
            }}
            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full transition-all ${
              currentTheme === theme.id
                ? 'bg-inverse text-inverse shadow-glow translate-y-[-1px]'
                : 'text-muted hover:bg-adaptive-surface hover:text-inverse'
            }`}
          >
            {theme.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          setMode(mode === 'dark' ? 'light' : 'dark');
        }}
        className='flex items-center justify-center p-2 rounded-full bg-inverse/5 border border-black/20 dark:border-white/20 hover:bg-adaptive-surface hover:text-inverse transition-all active:scale-90 shadow-glow'
        aria-label='Toggle Dark/Light Mode'
      >
        {mode === 'dark' ? (
          <div className='i-ph-moon-fill w-5 h-5 text-blue-400' />
        ) : (
          <div className='i-ph-sun-dim-fill w-5 h-5 text-amber-500' />
        )}
      </button>
    </div>
  );
};
