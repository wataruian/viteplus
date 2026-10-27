import { logger } from '@lightproject/common/logger';
import type { repositories } from '@lightproject/datastore';

import type { JsonValue, Script, ScriptContext } from '../../../src/core/script';

const context = (
  database: repositories.Database,
  overrides: Partial<ScriptContext> = {},
): ScriptContext => ({
  db: database,
  logger,
  scheduledTime: new Date(0),
  signal: new globalThis.AbortController().signal,
  trigger: 'manual',
  withTrace: <R>(fn: () => R) => fn(),
  ...overrides,
});

const runDirectly = async (script: Script, input: JsonValue, runContext: ScriptContext) => {
  const prepared = script.prepare(input);
  if ('error' in prepared) {
    throw new Error(`invalid input: ${prepared.error}`);
  }
  await prepared.run(runContext);
};

export { context, runDirectly };
