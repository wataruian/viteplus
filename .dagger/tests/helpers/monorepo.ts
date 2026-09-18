import { Monorepo } from '../../src';
import { FakeDirectory, FakeFile } from './dagger-fakes';
import { world } from './dagger-world';

const createMonorepo = (): Monorepo => {
  const source = new FakeDirectory(world);
  const daggerSource = new FakeDirectory(world);
  const templatesSource = new FakeDirectory(world);
  const commitlintConfig = FakeFile.of('');
  const plopfile = FakeFile.of('');

  return new Monorepo(source, daggerSource, templatesSource, commitlintConfig, plopfile);
};

export { createMonorepo };
