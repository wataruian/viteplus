import { beforeEach, describe, expect, test } from 'vite-plus/test';

import { getLastContainer, resetLastContainer } from './helpers/dagger-fakes';
import { resetDaggerWorld, world } from './helpers/dagger-world';
import { seedMountFiles } from './helpers/fixtures';
import { createMonorepo } from './helpers/monorepo';

beforeEach(() => {
  resetDaggerWorld();
  resetLastContainer();
});

describe('madge', () => {
  test('runs vpr -r madge on the installed root source', async () => {
    world.execStdout = 'madge output';

    const result = await createMonorepo().madge();

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'madge']);
    await expect(result.file('madge.output').contents()).resolves.toBe('madge output');
  });
});

describe('root', () => {
  test('runs root:check, then root:test:unit, on the installed root source', async () => {
    world.execStdout = 'root output';

    const result = await createMonorepo().root();

    expect(getLastContainer().capturedExecCalls.slice(-2)).toStrictEqual([
      ['vpr', '-r', 'root:check'],
      ['vpr', '-r', 'root:test:unit'],
    ]);
    await expect(result.file('root.output').contents()).resolves.toBe('root outputroot output');
  });
});

describe('ready', () => {
  test('runs vpr ready on the installed root source', async () => {
    world.execStdout = 'ready output';

    const result = await createMonorepo().ready();

    const container = getLastContainer();
    expect(container.capturedExecCalls).toContainEqual(['vpr', 'ready']);
    expect(container.capturedServiceBindings.get('postgres')?.capturedImage).toBe(
      'postgres:17.6-alpine',
    );
    for (const variable of ['DATASTORE_POSTGRES_URL', 'TASKS_POSTGRES_URL']) {
      expect(container.capturedEnvVariables.get(variable)).toBe(
        'postgres://lightproject:lightproject@postgres:5432/lightproject',
      );
    }
    await expect(result.file('ready.output').contents()).resolves.toBe('ready output');
  });
});

describe('check', () => {
  test('runs vpr -r check on the mounted workspace', async () => {
    seedMountFiles();
    world.execStdout = 'check output';

    const result = await createMonorepo().check('@lightproject/backend');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'check']);
    await expect(result.file('check.output').contents()).resolves.toBe('check output');
  });

  test('runs vpr -r dagger:check for the dagger workspace', async () => {
    world.execStdout = 'dagger check output';

    const result = await createMonorepo().check('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'dagger:check']);
    await expect(result.file('check.output').contents()).resolves.toBe('dagger check output');
  });
});

describe('format', () => {
  test('runs vpr -r format on the mounted workspace', async () => {
    seedMountFiles();
    world.execStdout = 'format output';

    const result = await createMonorepo().format('@lightproject/backend');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'format']);
    await expect(result.file('format.output').contents()).resolves.toBe('format output');
  });

  test('runs vpr -r dagger:format for the dagger workspace', async () => {
    world.execStdout = 'dagger format output';

    const result = await createMonorepo().format('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'dagger:format']);
    await expect(result.file('format.output').contents()).resolves.toBe('dagger format output');
  });
});

describe('lint', () => {
  test('runs vpr -r lint on the mounted workspace', async () => {
    seedMountFiles();
    world.execStdout = 'lint output';

    const result = await createMonorepo().lint('@lightproject/backend');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'lint']);
    await expect(result.file('lint.output').contents()).resolves.toBe('lint output');
  });

  test('runs vpr -rdagger:lint for the dagger workspace', async () => {
    world.execStdout = 'dagger lint output';

    const result = await createMonorepo().lint('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'dagger:lint']);
    await expect(result.file('lint.output').contents()).resolves.toBe('dagger lint output');
  });
});

describe('typeCheck', () => {
  test('runs vpr -r type-check on the mounted workspace', async () => {
    seedMountFiles();
    world.execStdout = 'type-check output';

    const result = await createMonorepo().typeCheck('@lightproject/backend');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'type-check']);
    await expect(result.file('type-check.output').contents()).resolves.toBe('type-check output');
  });

  test('runs vpr -r dagger:type-check for the dagger workspace', async () => {
    world.execStdout = 'dagger type-check output';

    const result = await createMonorepo().typeCheck('dagger');

    expect(getLastContainer().capturedExecCalls).toContainEqual(['vpr', '-r', 'dagger:type-check']);
    await expect(result.file('type-check.output').contents()).resolves.toBe(
      'dagger type-check output',
    );
  });
});
