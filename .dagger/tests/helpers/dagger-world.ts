class DaggerWorld {
  public execStdout = '';
  public execExitCode = 0;
  public readonly files = new Map<string, string>();
  public readonly dirs = new Map<string, string[]>();
}

const world = new DaggerWorld();

const resetDaggerWorld = (): void => {
  world.execStdout = '';
  world.execExitCode = 0;
  world.files.clear();
  world.dirs.clear();
};

const joinPath = (base: string, name: string): string => (base === '' ? name : `${base}/${name}`);

export { type DaggerWorld, joinPath, resetDaggerWorld, world };
