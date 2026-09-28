import { DocsContainer } from '@storybook/addon-docs/blocks';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { addons } from 'storybook/preview-api';
import { type ThemeVars, themes } from 'storybook/theming';

import type { Mode } from '../src/context/mode-context';
import { ModeProvider } from '../src/context/mode-provider';
import { ThemeProvider } from '../src/context/theme-provider';
import { isMode, modeChangedEvent, readStoredMode } from './mode-channel';

const useStorybookMode = (): Mode => {
  const [mode, setMode] = useState<Mode>(readStoredMode);

  useEffect(() => {
    const channel = addons.getChannel();
    const onModeChanged = (next: string) => {
      if (isMode(next)) {
        setMode(next);
      }
    };
    channel.on(modeChangedEvent, onModeChanged);
    return () => {
      channel.off(modeChangedEvent, onModeChanged);
    };
  }, []);

  return mode;
};

const useDocsMode = () => {
  const mode = useStorybookMode();
  return { mode, theme: mode === 'dark' ? themes.dark : themes.light };
};

const withDocsMode = <P extends { theme?: ThemeVars }>(Container: ComponentType<P>) => {
  const WithDocsMode = (props: P) => {
    const { mode, theme } = useDocsMode();

    return (
      <div className={mode}>
        <Container {...props} theme={theme} />
      </div>
    );
  };
  return WithDocsMode;
};

const CustomDocsContainer = withDocsMode(DocsContainer);

const ModeFrame = ({ children }: { children: ReactNode }) => {
  const mode = useStorybookMode();

  return (
    <ThemeProvider>
      <ModeProvider initialMode={mode}>
        <div className='p-4 bg-adaptive-surface text-inverse-surface min-h-screen'>{children}</div>
      </ModeProvider>
    </ThemeProvider>
  );
};

export { CustomDocsContainer, ModeFrame, useDocsMode, useStorybookMode, withDocsMode };
