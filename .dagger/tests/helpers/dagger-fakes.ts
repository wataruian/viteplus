import type * as DaggerModule from '@dagger.io/dagger';
import type {
  CacheVolume as CacheVolumeType,
  ClientCacheVolumeOpts,
  Client as ClientType,
  Container as ContainerType,
  ContainerWithDirectoryOpts,
  ContainerWithEnvVariableOpts,
  ContainerWithExecOpts,
  ContainerWithExposedPortOpts,
  ContainerWithFileOpts,
  ContainerWithMountedCacheOpts,
  ContainerWithMountedFileOpts,
  ContainerWithNewFileOpts,
  ContainerWithUnixSocketOpts,
  ContainerWithWorkdirOpts,
  DirectoryEntriesOpts,
  DirectoryFilterOpts,
  Directory as DirectoryType,
  DirectoryWithDirectoryOpts,
  DirectoryWithFileOpts,
  DirectoryWithNewFileOpts,
  FileContentsOpts,
  File as FileType,
  Secret,
  Socket,
} from '@dagger.io/dagger';
import { vi } from 'vite-plus/test';

import { type DaggerWorld, joinPath } from './dagger-world';

const { CacheVolume, Client, Container, Directory, File } =
  await vi.importActual<typeof DaggerModule>('@dagger.io/dagger');

const tick = async (): Promise<void> => {
  await Promise.resolve();
};

class FakeFile extends File {
  private readonly resolve: () => Promise<string>;

  public constructor(resolve: () => Promise<string>) {
    super();
    this.resolve = resolve;
  }

  public static of(content: string): FakeFile {
    return new FakeFile(async () => {
      await tick();
      return content;
    });
  }

  public override contents = async (_opts?: FileContentsOpts): Promise<string> =>
    await this.resolve();
}

const worldFile = (world: DaggerWorld, path: string): FakeFile =>
  new FakeFile(async () => {
    await tick();
    const content = world.files.get(path);
    if (content === undefined) {
      throw new Error(`fake file not found: ${path}`);
    }
    return content;
  });

class FakeDirectory extends Directory {
  private readonly world: DaggerWorld;
  private readonly path: string;
  private readonly localFiles = new Map<string, string>();
  private readonly localFileRefs = new Map<string, FakeFile>();
  private readonly localDirs = new Map<string, FakeDirectory>();

  public constructor(world: DaggerWorld, path = '') {
    super();
    this.world = world;
    this.path = path;
  }

  public override withNewFile = (
    name: string,
    content: string,
    _opts?: DirectoryWithNewFileOpts,
  ): this => {
    this.localFiles.set(name, content);
    return this;
  };

  public override withFile = (
    name: string,
    file: FileType,
    _opts?: DirectoryWithFileOpts,
  ): this => {
    this.localFileRefs.set(name, file instanceof FakeFile ? file : FakeFile.of(''));
    return this;
  };

  public override withDirectory = (
    name: string,
    dir: DirectoryType,
    _opts?: DirectoryWithDirectoryOpts,
  ): this => {
    this.localDirs.set(name, dir instanceof FakeDirectory ? dir : new FakeDirectory(this.world));
    return this;
  };

  public override filter = (_opts?: DirectoryFilterOpts): this => this;

  public override file = (name: string): FakeFile => {
    const ref = this.localFileRefs.get(name);
    if (ref) {
      return ref;
    }

    const content = this.localFiles.get(name);
    if (content !== undefined) {
      return FakeFile.of(content);
    }

    return worldFile(this.world, joinPath(this.path, name));
  };

  public override directory = (name: string): FakeDirectory => {
    const local = this.localDirs.get(name);
    if (local) {
      return local;
    }

    return new FakeDirectory(this.world, joinPath(this.path, name));
  };

  public override entries = async (_opts?: DirectoryEntriesOpts): Promise<string[]> => {
    await tick();

    if (this.localFiles.size > 0 || this.localFileRefs.size > 0 || this.localDirs.size > 0) {
      return [
        ...this.localFiles.keys(),
        ...this.localFileRefs.keys(),
        ...[...this.localDirs.keys()].map((name) => `${name}/`),
      ];
    }

    const entries = this.world.dirs.get(this.path);
    if (entries === undefined) {
      throw new Error(`fake directory not found: ${this.path}`);
    }
    return entries;
  };
}

class FakeContainer extends Container {
  public readonly capturedEnvVariables = new Map<string, string>();
  public readonly capturedCachePaths: string[] = [];
  public readonly capturedDirectoryPaths: string[] = [];
  public readonly capturedExecCalls: string[][] = [];
  public readonly capturedPublishedRefs: string[] = [];
  public capturedWorkdir: string | undefined = undefined;
  public capturedDefaultArgs: string[] | undefined = undefined;
  public capturedImage: string | undefined = undefined;

  private readonly world: DaggerWorld;

  public constructor(world: DaggerWorld) {
    super();
    this.world = world;
  }

  public override from = (image: string): this => {
    this.capturedImage = image;
    return this;
  };

  public override withWorkdir = (path: string, _opts?: ContainerWithWorkdirOpts): this => {
    this.capturedWorkdir = path;
    return this;
  };

  public override withDirectory = (
    path: string,
    _source: DirectoryType,
    _opts?: ContainerWithDirectoryOpts,
  ): this => {
    this.capturedDirectoryPaths.push(path);
    return this;
  };

  public override withFile = (
    _path: string,
    _source: FileType,
    _opts?: ContainerWithFileOpts,
  ): this => this;

  public override withNewFile = (
    _path: string,
    _contents: string,
    _opts?: ContainerWithNewFileOpts,
  ): this => this;

  public override withMountedFile = (
    _path: string,
    _source: FileType,
    _opts?: ContainerWithMountedFileOpts,
  ): this => this;

  public override withMountedCache = (
    path: string,
    _cache: CacheVolumeType,
    _opts?: ContainerWithMountedCacheOpts,
  ): this => {
    this.capturedCachePaths.push(path);
    return this;
  };

  public override withEnvVariable = (
    name: string,
    value: string,
    _opts?: ContainerWithEnvVariableOpts,
  ): this => {
    this.capturedEnvVariables.set(name, value);
    return this;
  };

  public override withSecretVariable = (_name: string, _secret: Secret): this => this;

  public override withUnixSocket = (
    _path: string,
    _source: Socket,
    _opts?: ContainerWithUnixSocketOpts,
  ): this => this;

  public override withExposedPort = (_port: number, _opts?: ContainerWithExposedPortOpts): this =>
    this;

  public override withDefaultArgs = (args: string[]): this => {
    this.capturedDefaultArgs = args;
    return this;
  };

  public override withExec = (args: string[], _opts?: ContainerWithExecOpts): this => {
    this.capturedExecCalls.push(args);
    return this;
  };

  public override stdout = async (): Promise<string> => {
    await tick();
    return this.world.execStdout;
  };

  public override exitCode = async (): Promise<number> => {
    await tick();
    return this.world.execExitCode;
  };

  public override directory = (path: string): FakeDirectory => new FakeDirectory(this.world, path);

  public override file = (path: string): FakeFile => worldFile(this.world, path);

  public override publish = async (ref: string): Promise<string> => {
    await tick();
    this.capturedPublishedRefs.push(ref);
    return `${ref}@sha256:fakedigest`;
  };

  public override asTarball = (): FakeFile => this.file('__tarball__');
}

let lastContainer: FakeContainer | undefined = undefined;

class FakeClient extends Client {
  public readonly capturedCacheVolumeKeys: string[] = [];

  private readonly world: DaggerWorld;

  public constructor(world: DaggerWorld) {
    super();
    this.world = world;
  }

  public override cacheVolume = (key: string, _opts?: ClientCacheVolumeOpts): CacheVolumeType => {
    this.capturedCacheVolumeKeys.push(key);
    return new CacheVolume();
  };

  public override container = (): FakeContainer => {
    const container = new FakeContainer(this.world);
    lastContainer = container;
    return container;
  };

  public override directory = (): FakeDirectory => new FakeDirectory(this.world);
}

const createFakeDag = (world: DaggerWorld): ClientType => new FakeClient(world);

const getLastContainer = (): FakeContainer => {
  if (!lastContainer) {
    throw new Error('no fake container has been created yet');
  }
  return lastContainer;
};

const resetLastContainer = (): void => {
  lastContainer = undefined;
};

const asFakeDirectory = (directory: DirectoryType): FakeDirectory => {
  if (!(directory instanceof FakeDirectory)) {
    throw new Error('expected a FakeDirectory');
  }
  return directory;
};

const asFakeContainer = (container: ContainerType): FakeContainer => {
  if (!(container instanceof FakeContainer)) {
    throw new Error('expected a FakeContainer');
  }
  return container;
};

export {
  asFakeContainer,
  asFakeDirectory,
  createFakeDag,
  FakeContainer,
  FakeDirectory,
  FakeFile,
  getLastContainer,
  resetLastContainer,
};
