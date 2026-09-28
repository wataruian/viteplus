const storybookPort = Math.trunc(Number(globalThis.process.env['STORYBOOK_E2E_PORT'] ?? '6116'));

const previewAppPort = Math.trunc(
  Number(globalThis.process.env['DESIGN_SYSTEM_E2E_PORT'] ?? '6117'),
);

const previewAppUrl = `http://localhost:${previewAppPort}/`;

export { previewAppPort, previewAppUrl, storybookPort };
