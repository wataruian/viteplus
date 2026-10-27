interface ThemeColors {
  accent: string;
  danger?: string | undefined;
  info?: string | undefined;
  primary: string;
  success?: string | undefined;
  surface?: string | undefined;
  warning?: string | undefined;
}

type Themes = Readonly<Record<string, ThemeColors>>;

const defaultThemes = {
  default: {
    accent: '#10b981',
    primary: '#8b5cf6',
  },
  emerald: {
    accent: '#3b82f6',
    primary: '#10b981',
  },
  ocean: {
    accent: '#8b5cf6',
    primary: '#0ea5e9',
  },
  sunset: {
    accent: '#f59e0b',
    primary: '#f43f5e',
  },
} as const satisfies Themes;

const themeNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export { defaultThemes, themeNamePattern };
export type { ThemeColors, Themes };
