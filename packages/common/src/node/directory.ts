import fs from 'node:fs';
import np from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.process.versions.node !== 'string') {
  throw new TypeError(
    '@lightproject/common/node/directory requires a Node.js-compatible runtime (Node.js, Bun, or Deno) and cannot run in a browser or on edge/Workers runtimes.',
  );
}

const pathExists = (path: string): boolean => {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
};

const getScriptDir = (): string => import.meta.dirname;

const getScriptFilePath = (): string => import.meta.filename;

const getScriptFileName = (): string => np.basename(import.meta.filename);

const getImporterDir = (): string => {
  const error = new Error('Getting importer directory');
  const stackFrames = error.stack?.split('\n') ?? [];

  for (let i = 2; i < stackFrames.length; i += 1) {
    const frame = stackFrames[i].trim();

    const match =
      /at\s+(?:[^(]+\s+)?\(?(?<file1>[^)]+?):\d+:\d+\)?$/u.exec(frame) ??
      /\s+at\s+(?<file2>.+?):\d+:\d+/u.exec(frame) ??
      /\(?(?<file3>[^)]+?):\d+:\d+\)?$/u.exec(frame);

    const filePath0 = match?.[1];
    if (filePath0 === undefined || filePath0 === '') {
      continue;
    }

    let filePath = filePath0.trim();

    if (filePath.startsWith('file://')) {
      filePath = fileURLToPath(filePath);
    }

    if (filePath === getScriptFilePath()) {
      continue;
    }

    if (pathExists(filePath)) {
      return np.dirname(filePath);
    }
  }

  return globalThis.process.cwd();
};

const getImporterFilePath = (): string => {
  const error = new Error('Getting importer file');
  const stackFrames = error.stack?.split('\n') ?? [];

  for (let i = 2; i < stackFrames.length; i += 1) {
    const frame = stackFrames[i].trim();
    const match = /(?:at\s+(?:.+?\s+\()?)(?<file>(?:file:\/\/)?[^():]+):\d+:\d+\)?$/u.exec(frame);
    const filePath0 = match?.groups?.['file'];
    if (filePath0 === undefined || filePath0 === '') {
      continue;
    }

    const filePath = filePath0.startsWith('file://') ? fileURLToPath(filePath0) : filePath0;

    if (filePath === getScriptFilePath()) {
      continue;
    }

    return filePath;
  }

  return globalThis.process.argv[1] ?? '';
};

const getImporterFileName = (): string => np.basename(getImporterFilePath());

const getCallerDir = (): string => globalThis.process.cwd();

const getCallerFilePath = (): string => globalThis.process.argv[1] ?? '';

const getCallerFileName = (): string => np.basename(getCallerFilePath());

const isDirectory = (path: string): boolean => {
  if (!pathExists(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }

  return fs.lstatSync(path).isDirectory();
};

const getProjectRoot = (startDir: string = getScriptDir(), marker = '.git'): string => {
  const root = np.resolve('/');
  let currentDir = np.resolve(startDir);

  while (currentDir !== root) {
    const potentialMarker = np.resolve(currentDir, marker);

    if (pathExists(potentialMarker)) {
      return currentDir;
    }

    currentDir = np.dirname(currentDir);
  }

  throw new Error(`Could not find project root directory (looking for ${marker})`);
};

const readFile = ({
  encoding = 'utf8',
  path,
  throwError = true,
}: {
  encoding?: BufferEncoding | null | undefined;
  path: string;
  throwError?: boolean;
}): Buffer | null | string => {
  const exists = pathExists(path);
  if (!exists && throwError) {
    throw new Error(`File does not exist: ${path}`);
  }

  if (exists) {
    const isDir = isDirectory(path);
    if (isDir && throwError) {
      throw new Error(`Path is a directory, not a file: ${path}`);
    }
    if (!isDir) {
      const options = { encoding: encoding ?? undefined };
      return fs.readFileSync(path, options);
    }
  }

  return null;
};

const createDir = ({
  path,
  recursive = true,
  throwError = false,
}: {
  path: string;
  recursive?: boolean;
  throwError?: boolean;
}): void => {
  if (pathExists(path) && throwError) {
    throw new Error(`Directory already exists: ${path}`);
  }

  fs.mkdirSync(path, { recursive });
};

const createFile = ({
  content = '',
  encoding = 'utf8',
  path,
  replace = false,
  throwError = true,
}: {
  content?: string;
  encoding?: BufferEncoding | null | undefined;
  path: string;
  replace?: boolean;
  throwError?: boolean;
}): void => {
  const exists = pathExists(path);
  if (exists && !replace && throwError) {
    const error = isDirectory(path)
      ? new Error(`A directory exists for this path, cannot create file: ${path}`)
      : new Error(`A file already exists for this path, cannot create file: ${path}`);
    throw error;
  }

  if (!exists || replace) {
    const options = { encoding: encoding ?? undefined };

    fs.writeFileSync(path, content || '', options);
  }
};

const deletePath = ({
  force = true,
  path,
  recursive = true,
  throwError = true,
}: {
  force?: boolean;
  path: string;
  recursive?: boolean;
  throwError?: boolean;
}): void => {
  const exists = pathExists(path);
  if (!exists && throwError && !force) {
    throw new Error(`Path does not exist: ${path}`);
  }

  if (exists) {
    const isDir = isDirectory(path);
    if (isDir) {
      fs.rmSync(path, { force, recursive });
    } else {
      fs.unlinkSync(path);
    }
  }
};

const resolveTransferGuard = ({
  destinationPath,
  replace,
  sourcePath,
  throwError,
}: {
  destinationPath: string;
  replace: boolean;
  sourcePath: string;
  throwError: boolean;
}): boolean => {
  const sourceExists = pathExists(sourcePath);

  if (!sourceExists && throwError) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const destinationExists = pathExists(destinationPath);

  if (destinationExists && throwError) {
    throw new Error(`Destination path already exists: ${destinationPath}`);
  }

  return (sourceExists && !destinationExists) || (sourceExists && destinationExists && replace);
};

const copyPath = ({
  destinationPath,
  force = true,
  recursive = true,
  replace = false,
  sourcePath,
  throwError = true,
}: {
  destinationPath: string;
  force?: boolean;
  recursive?: boolean;
  replace?: boolean;
  sourcePath: string;
  throwError?: boolean;
}): void => {
  const shouldTransfer = resolveTransferGuard({ destinationPath, replace, sourcePath, throwError });

  if (shouldTransfer) {
    if (replace) {
      deletePath({ force, path: destinationPath, recursive });
    }

    const isDir = isDirectory(sourcePath);
    if (isDir) {
      fs.cpSync(sourcePath, destinationPath, { force, recursive });
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
};

const movePath = ({
  destinationPath,
  force = true,
  recursive = true,
  replace = false,
  sourcePath,
  throwError = true,
}: {
  destinationPath: string;
  force?: boolean;
  recursive?: boolean;
  replace?: boolean;
  sourcePath: string;
  throwError?: boolean;
}): void => {
  const shouldTransfer = resolveTransferGuard({ destinationPath, replace, sourcePath, throwError });

  if (shouldTransfer) {
    if (replace) {
      deletePath({ force, path: destinationPath, recursive });
    }

    fs.renameSync(sourcePath, destinationPath);
  }
};

const backupPath = ({
  destinationPath = '',
  force = true,
  recursive = true,
  replace = false,
  sourcePath,
  throwError = true,
}: {
  destinationPath?: string;
  force?: boolean;
  recursive?: boolean;
  replace?: boolean;
  sourcePath: string;
  throwError?: boolean;
}): void => {
  if (!pathExists(sourcePath)) {
    throw new Error(`Path does not exist: ${sourcePath}`);
  }

  const backupDirName = np.dirname(sourcePath);
  const backupBaseName = `${np.basename(sourcePath)}.${Date.now()}.bak`;
  const pathToBackup = np.resolve(destinationPath || np.join(backupDirName, backupBaseName));

  if (pathExists(pathToBackup) && throwError) {
    throw new Error(`Backup file already exists: ${pathToBackup}`);
  }

  createDir({
    path: np.dirname(pathToBackup),
    recursive,
  });

  copyPath({
    destinationPath: pathToBackup,
    force,
    recursive,
    replace,
    sourcePath,
  });
};

export {
  backupPath,
  copyPath,
  createDir,
  createFile,
  deletePath,
  getCallerDir,
  getCallerFileName,
  getCallerFilePath,
  getImporterDir,
  getImporterFileName,
  getImporterFilePath,
  getProjectRoot,
  getScriptDir,
  getScriptFileName,
  getScriptFilePath,
  isDirectory,
  movePath,
  pathExists,
  readFile,
  resolveTransferGuard,
};
