import { WORKSPACE_NAMES } from '../../src/helpers/constants';
import { workspacePath } from '../../src/helpers/container';
import { world } from './dagger-world';

const seedPackageJsons = (overrides: Record<string, Record<string, unknown>> = {}): void => {
  for (const name of WORKSPACE_NAMES) {
    const dir = workspacePath(name);
    world.files.set(`${dir}/package.json`, JSON.stringify(overrides[name] ?? {}));
  }
};

const seedMountFiles = (prunedFullEntries: string[] = []): void => {
  seedPackageJsons();
  world.dirs.set('.pruned/full', prunedFullEntries);
};

export { seedMountFiles, seedPackageJsons };
