import { createElement, useState } from 'react';
import { IconButton } from 'storybook/internal/components';
import { addons, types, useStorybookApi } from 'storybook/manager-api';

import type { Mode } from '../src/context/mode-context';
import { modeChangedEvent, readStoredMode, storeMode } from './mode-channel';

const ModeTool = () => {
  const api = useStorybookApi();
  const [mode, setMode] = useState<Mode>(readStoredMode);

  const toggleMode = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    storeMode(next);
    setMode(next);
    api.emit(modeChangedEvent, next);
  };

  return createElement(
    IconButton,
    { onClick: toggleMode, title: `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode` },
    mode === 'dark' ? '☾ Dark' : '☀ Light',
  );
};

const registerModeTool = () => {
  addons.register('lightproject/mode', () => {
    addons.add('lightproject/mode/tool', {
      match: () => true,
      render: ModeTool,
      title: 'Mode',
      type: types.TOOL,
    });
  });
};

registerModeTool();

export { ModeTool, registerModeTool };
