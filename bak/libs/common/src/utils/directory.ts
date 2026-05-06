import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regex patterns for stack frame parsing
const STACK_FRAME_PATTERN_1 = /at\s+(?:[^(]+\s+)?\(?([^)]+?):\d+:\d+\)?$/;
const STACK_FRAME_PATTERN_2 = /\s+at\s+(.+?):\d+:\d+/;
const STACK_FRAME_PATTERN_3 = /\(?(.+?):\d+:\d+\)?$/;
const FILE_URL_PATTERN = /^file:\/\//;

const getScriptDir = (): string => {
  return path.dirname(fileURLToPath(import.meta.url));
};

/**
 * Finds the project root directory by looking for a marker file (default: package.json)
 * @param startDir The directory to start searching from (defaults to current file's directory)
 * @param marker The marker file to look for (default: 'package.json')
 * @returns The absolute path to the project root directory
 * @throws {Error} If the project root cannot be found
 */
const findProjectRoot = (
  startDir: string = getScriptDir(),
  marker = '.git'
): string => {
  const root = path.resolve('/');
  let currentDir = path.resolve(startDir);

  while (currentDir !== root) {
    const potentialMarker = path.resolve(currentDir, marker);

    if (pathExists(potentialMarker)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // We've reached the filesystem root without finding the marker
      break;
    }
    currentDir = parentDir;
  }

  throw new Error(
    `Could not find project root directory (looking for ${marker})`
  );
};

/**
 * Gets the project root directory and caches the result
 */
// let cachedProjectRoot: string | undefined;

const getProjectRoot = (): string => {
  // if (!cachedProjectRoot) {
  //   cachedProjectRoot = findProjectRoot();
  // }
  return findProjectRoot();
};

const getScriptFile = (): string => {
  return fileURLToPath(import.meta.url);
};

const getFileName = (): string => {
  return path.basename(fileURLToPath(import.meta.url));
};

const getImporterDir = (): string => {
  const error = new Error('Getting importer directory');
  const stackFrames = error.stack?.split('\n') || [];

  // Skip the first frame (this function) and the second frame (the caller of this function)
  // to get to the actual importer
  for (let i = 2; i < stackFrames.length; i++) {
    const frame = stackFrames[i]?.trim() || '';

    const match =
      frame.match(STACK_FRAME_PATTERN_1) ||
      frame.match(STACK_FRAME_PATTERN_2) ||
      frame.match(STACK_FRAME_PATTERN_3);

    if (!match?.[1]) {
      continue;
    }

    let filePath = match[1].trim();

    if (FILE_URL_PATTERN.test(filePath)) {
      filePath = fileURLToPath(filePath);
    }

    if (filePath === getScriptFile()) {
      continue;
    }

    if (pathExists(filePath)) {
      return path.dirname(filePath);
    }
  }

  return process.cwd();
};

const pathExists = (path: string): boolean => {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
};

const getImporterFile = (): string => {
  const error = new Error('Getting importer file');
  const stackFrames = error.stack?.split('\n') || [];

  // Skip the first frame (this function) and the second frame (the caller of this function)
  // to get to the actual importer
  for (let i = 2; i < stackFrames.length; i++) {
    const frame = stackFrames[i]?.trim() || '';
    const match = frame.match(STACK_FRAME_PATTERN_3);
    if (!match?.[1]) {
      continue;
    }

    const filePath = FILE_URL_PATTERN.test(match[1])
      ? fileURLToPath(match[1])
      : match[1];

    if (filePath === getScriptFile()) {
      continue;
    }

    return filePath;
  }

  return process.argv[1] || ''; // Fallback to main script
};

const getCallerDir = (): string => {
  // Return the current working directory of the Node.js process
  // This is the directory where the node command was executed from
  return process.cwd();
};

const getCallerFile = (): string => {
  // Return the path of the script that was run with Node.js
  return process.argv[1] || '';
};

const isDirectory = (path: string): boolean => {
  if (!pathExists(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }

  return fs.lstatSync(path).isDirectory();
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
      const options = {
        encoding:
          encoding === null || encoding === undefined ? undefined : encoding,
      };
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
      ? new Error(
          `A directory exists for this path, cannot create file: ${path}`
        )
      : new Error(
          `A file already exists for this path, cannot create file: ${path}`
        );
    throw error;
  }

  if (!exists || replace) {
    const options = {
      encoding:
        encoding === null || encoding === undefined ? undefined : encoding,
    };

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
  const sourceExists = pathExists(sourcePath);
  if (!sourceExists && throwError) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const destinationExists = pathExists(destinationPath);
  if (destinationExists && throwError) {
    throw new Error(`Destination path already exists: ${destinationPath}`);
  }

  if (
    (sourceExists && !destinationExists) ||
    (sourceExists && destinationExists && replace)
  ) {
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
  const sourceExists = pathExists(sourcePath);
  if (!sourceExists && throwError) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const destinationExists = pathExists(destinationPath);
  if (destinationExists && throwError) {
    throw new Error(`Destination path already exists: ${destinationPath}`);
  }

  if (
    (sourceExists && !destinationExists) ||
    (sourceExists && destinationExists && replace)
  ) {
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

  const backupDirName = path.dirname(sourcePath);
  const backupBaseName = `${path.basename(sourcePath)}.${Date.now()}.bak`;
  const backupPath = path.resolve(
    destinationPath || path.join(backupDirName, backupBaseName)
  );

  if (pathExists(backupPath) && throwError) {
    throw new Error(`Backup file already exists: ${backupPath}`);
  }

  createDir({
    path: path.dirname(backupPath),
    recursive,
  });

  copyPath({
    destinationPath: backupPath,
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
  findProjectRoot,
  getCallerDir,
  getCallerFile,
  getFileName,
  getImporterDir,
  getImporterFile,
  getProjectRoot,
  getScriptDir,
  getScriptFile,
  isDirectory,
  movePath,
  pathExists,
  readFile,
};
