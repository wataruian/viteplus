import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import {
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
} from '../src/node/directory';

const getPrepareStackTraceDescriptor = (): PropertyDescriptor =>
  Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace') ?? {
    configurable: true,
    value: undefined,
    writable: true,
  };

const withStack = <T>(stackText: string, fn: () => T): T => {
  const original = getPrepareStackTraceDescriptor();
  Error.prepareStackTrace = () => stackText;
  try {
    return fn();
  } finally {
    Object.defineProperty(Error, 'prepareStackTrace', original);
  }
};

let tempDir = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-test-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { force: true, recursive: true });
});

describe('pathExists', () => {
  test('returns true for a path that exists', () => {
    expect(pathExists(tempDir)).toBe(true);
  });

  test('returns false for a path that does not exist', () => {
    expect(pathExists(path.join(tempDir, 'nope'))).toBe(false);
  });
});

describe('getScriptDir / getScriptFilePath / getScriptFileName', () => {
  test('point at directory.ts itself, not the caller', () => {
    expect(getScriptFileName()).toBe('directory.ts');
    expect(getScriptFilePath().endsWith(path.join('src', 'node', 'directory.ts'))).toBe(true);
    expect(getScriptDir().endsWith(path.join('src', 'node'))).toBe(true);
  });
});

describe('getImporterDir / getImporterFilePath / getImporterFileName', () => {
  test('point at the calling test file, not directory.ts', () => {
    expect(getImporterFileName()).toBe('directory.test.ts');
    expect(getImporterFilePath().endsWith('directory.test.ts')).toBe(true);
    expect(pathExists(getImporterDir())).toBe(true);
  });
});

describe('getCallerDir / getCallerFilePath / getCallerFileName', () => {
  test('reflect the current process cwd and entry script', () => {
    expect(getCallerDir()).toBe(globalThis.process.cwd());
    expect(getCallerFilePath()).toBe(globalThis.process.argv[1] ?? '');
    expect(getCallerFileName()).toBe(path.basename(globalThis.process.argv[1] ?? ''));
  });
});

describe('isDirectory', () => {
  test('returns true for a directory and false for a file', () => {
    const filePath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(filePath, 'hello');

    expect(isDirectory(tempDir)).toBe(true);
    expect(isDirectory(filePath)).toBe(false);
  });

  test('throws when the path does not exist', () => {
    expect(() => {
      isDirectory(path.join(tempDir, 'nope'));
    }).toThrow(/does not exist/u);
  });
});

describe('getProjectRoot', () => {
  test('finds the nearest ancestor directory containing the marker', () => {
    const markerDir = path.join(tempDir, 'root');
    const nested = path.join(markerDir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(markerDir, '.marker'));

    expect(getProjectRoot(nested, '.marker')).toBe(path.resolve(markerDir));
  });

  test('throws when no ancestor contains the marker', () => {
    expect(() => {
      getProjectRoot(tempDir, '.this-marker-does-not-exist-anywhere');
    }).toThrow(/Could not find project root/u);
  });
});

describe('readFile', () => {
  test('reads the content of an existing file', () => {
    const filePath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(filePath, 'hello world');
    expect(readFile({ path: filePath })).toBe('hello world');
  });

  test('throws for a non-existent path by default', () => {
    expect(() => {
      readFile({ path: path.join(tempDir, 'nope.txt') });
    }).toThrow(/does not exist/u);
  });

  test('returns null for a non-existent path when throwError is false', () => {
    expect(readFile({ path: path.join(tempDir, 'nope.txt'), throwError: false })).toBeNull();
  });

  test('throws when the path is a directory by default', () => {
    expect(() => {
      readFile({ path: tempDir });
    }).toThrow(/directory, not a file/u);
  });

  test('returns null when the path is a directory and throwError is false', () => {
    expect(readFile({ path: tempDir, throwError: false })).toBeNull();
  });
});

describe('createDir', () => {
  test('creates a directory, recursively by default', () => {
    const nested = path.join(tempDir, 'a', 'b', 'c');
    createDir({ path: nested });
    expect(pathExists(nested)).toBe(true);
  });

  test('does not throw if the directory already exists by default', () => {
    expect(() => {
      createDir({ path: tempDir });
    }).not.toThrow();
  });

  test('throws if the directory already exists and throwError is true', () => {
    expect(() => {
      createDir({ path: tempDir, throwError: true });
    }).toThrow(/already exists/u);
  });
});

describe('createFile', () => {
  test('creates a file with the given content', () => {
    const filePath = path.join(tempDir, 'new-file.txt');
    createFile({ content: 'hello', path: filePath });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('hello');
  });

  test('throws if a file already exists at the path and replace is false', () => {
    const filePath = path.join(tempDir, 'existing.txt');
    fs.writeFileSync(filePath, 'original');
    expect(() => {
      createFile({ content: 'new', path: filePath });
    }).toThrow(/file already exists/u);
  });

  test('throws a directory-specific message if a directory exists at the path', () => {
    expect(() => {
      createFile({ content: 'new', path: tempDir });
    }).toThrow(/directory exists for this path/u);
  });

  test('overwrites the existing file when replace is true', () => {
    const filePath = path.join(tempDir, 'existing.txt');
    fs.writeFileSync(filePath, 'original');
    createFile({ content: 'replaced', path: filePath, replace: true });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('replaced');
  });
});

describe('deletePath', () => {
  test('deletes a file', () => {
    const filePath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(filePath, 'hello');
    deletePath({ path: filePath });
    expect(pathExists(filePath)).toBe(false);
  });

  test('deletes a directory recursively', () => {
    const nested = path.join(tempDir, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    deletePath({ path: path.join(tempDir, 'a') });
    expect(pathExists(path.join(tempDir, 'a'))).toBe(false);
  });

  test('does not throw for a missing path by default (force defaults to true)', () => {
    expect(() => {
      deletePath({ path: path.join(tempDir, 'nope') });
    }).not.toThrow();
  });

  test('throws for a missing path when throwError is true and force is false', () => {
    expect(() => {
      deletePath({ force: false, path: path.join(tempDir, 'nope'), throwError: true });
    }).toThrow(/does not exist/u);
  });
});

describe('copyPath', () => {
  test('copies a file to a new path', () => {
    const source = path.join(tempDir, 'source.txt');
    const destination = path.join(tempDir, 'destination.txt');
    fs.writeFileSync(source, 'hello');

    copyPath({ destinationPath: destination, sourcePath: source });

    expect(fs.readFileSync(destination, 'utf8')).toBe('hello');
    expect(pathExists(source)).toBe(true);
  });

  test('copies a directory recursively', () => {
    const source = path.join(tempDir, 'source-dir');
    const destination = path.join(tempDir, 'destination-dir');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'file.txt'), 'nested content');

    copyPath({ destinationPath: destination, sourcePath: source });

    expect(fs.readFileSync(path.join(destination, 'file.txt'), 'utf8')).toBe('nested content');
  });

  test('throws when the source does not exist', () => {
    expect(() => {
      copyPath({
        destinationPath: path.join(tempDir, 'dest.txt'),
        sourcePath: path.join(tempDir, 'missing.txt'),
      });
    }).toThrow(/Source path does not exist/u);
  });

  test('throws when the destination already exists and replace is false', () => {
    const source = path.join(tempDir, 'source.txt');
    const destination = path.join(tempDir, 'destination.txt');
    fs.writeFileSync(source, 'hello');
    fs.writeFileSync(destination, 'already here');

    expect(() => {
      copyPath({ destinationPath: destination, sourcePath: source });
    }).toThrow(/Destination path already exists/u);
  });

  test('overwrites the destination when replace is true', () => {
    const source = path.join(tempDir, 'source.txt');
    const destination = path.join(tempDir, 'destination.txt');
    fs.writeFileSync(source, 'new content');
    fs.writeFileSync(destination, 'old content');

    copyPath({
      destinationPath: destination,
      replace: true,
      sourcePath: source,
      throwError: false,
    });

    expect(fs.readFileSync(destination, 'utf8')).toBe('new content');
  });
});

describe('movePath', () => {
  test('moves a file to a new path', () => {
    const source = path.join(tempDir, 'source.txt');
    const destination = path.join(tempDir, 'destination.txt');
    fs.writeFileSync(source, 'hello');

    movePath({ destinationPath: destination, sourcePath: source });

    expect(pathExists(source)).toBe(false);
    expect(fs.readFileSync(destination, 'utf8')).toBe('hello');
  });

  test('throws when the source does not exist', () => {
    expect(() => {
      movePath({
        destinationPath: path.join(tempDir, 'dest.txt'),
        sourcePath: path.join(tempDir, 'missing.txt'),
      });
    }).toThrow(/Source path does not exist/u);
  });
});

describe('backupPath', () => {
  test('creates a timestamped .bak copy alongside the source by default', () => {
    const source = path.join(tempDir, 'important.txt');
    fs.writeFileSync(source, 'precious data');

    backupPath({ sourcePath: source });

    const backups = fs.readdirSync(tempDir).filter((name) => name.startsWith('important.txt.'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tempDir, backups[0] ?? ''), 'utf8')).toBe('precious data');
  });

  test('backs up to an explicit destination path, creating parent directories', () => {
    const source = path.join(tempDir, 'important.txt');
    const destination = path.join(tempDir, 'backups', 'important.bak');
    fs.writeFileSync(source, 'precious data');

    backupPath({ destinationPath: destination, sourcePath: source });

    expect(fs.readFileSync(destination, 'utf8')).toBe('precious data');
  });

  test('throws when the source does not exist', () => {
    expect(() => {
      backupPath({ sourcePath: path.join(tempDir, 'missing.txt') });
    }).toThrow(/Path does not exist/u);
  });

  test('throws when the backup destination already exists', () => {
    const source = path.join(tempDir, 'important.txt');
    const destination = path.join(tempDir, 'important.bak');
    fs.writeFileSync(source, 'precious data');
    fs.writeFileSync(destination, 'already here');

    expect(() => {
      backupPath({ destinationPath: destination, sourcePath: source });
    }).toThrow(/Backup file already exists/u);
  });
});

describe('module load guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('throws a TypeError at import time when process.versions.node is not a string', async () => {
    vi.stubGlobal('process', {
      ...globalThis.process,
      versions: { ...globalThis.process.versions, node: undefined },
    });
    vi.resetModules();

    await expect(import('../src/node/directory')).rejects.toThrow(TypeError);
  });
});

describe('getImporterDir - stack parsing branches', () => {
  test('skips frames with no location info and frames pointing at non-existent files', () => {
    const existingFile = path.join(tempDir, 'caller.js');
    fs.writeFileSync(existingFile, '// caller');

    const stack = [
      'Error: Getting importer directory',
      `    at getImporterDir (${getScriptFilePath()}:26:19)`,
      '    totally unparseable frame',
      '    at /this/path/does/not/exist.js:5:5',
      `    at Object.<anonymous> (${existingFile}:12:34)`,
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterDir()).toBe(path.dirname(existingFile));
    });
  });

  test('skips a frame pointing back at directory.ts itself before finding the real caller', () => {
    const existingFile = path.join(tempDir, 'caller2.js');
    fs.writeFileSync(existingFile, '// caller');

    const stack = [
      'Error: Getting importer directory',
      `    at getImporterDir (${getScriptFilePath()}:26:19)`,
      `    at someInternalWrapper (${getScriptFilePath()}:200:1)`,
      `    at Object.<anonymous> (${existingFile}:12:34)`,
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterDir()).toBe(path.dirname(existingFile));
    });
  });

  test('converts a file:// URL frame to a filesystem path', () => {
    const existingFile = path.join(tempDir, 'caller3.js');
    fs.writeFileSync(existingFile, '// caller');
    const fileUrl = `file://${existingFile}`;

    const stack = [
      'Error: Getting importer directory',
      `    at getImporterDir (${getScriptFilePath()}:26:19)`,
      `    at Object.<anonymous> (${fileUrl}:12:34)`,
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterDir()).toBe(path.dirname(existingFile));
    });
  });

  test('falls back to the current working directory when no frame resolves', () => {
    const stack = [
      'Error: Getting importer directory',
      `    at getImporterDir (${getScriptFilePath()}:26:19)`,
      '    junk frame one',
      '    junk frame two',
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterDir()).toBe(globalThis.process.cwd());
    });
  });
});

describe('getImporterFilePath - stack parsing branches', () => {
  test('returns the first non-self file path found in the stack', () => {
    const stack = [
      'Error: Getting importer file',
      `    at getImporterFilePath (${getScriptFilePath()}:60:19)`,
      '    at Object.<anonymous> (/some/other/file.js:99:1)',
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterFilePath()).toBe('/some/other/file.js');
    });
  });

  test('converts a file:// URL frame to a filesystem path', () => {
    const stack = [
      'Error: Getting importer file',
      `    at getImporterFilePath (${getScriptFilePath()}:60:19)`,
      '    at Object.<anonymous> (file:///some/other/file.js:99:1)',
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterFilePath()).toBe('/some/other/file.js');
    });
  });

  test('skips a frame pointing back at directory.ts itself before finding the real caller', () => {
    const stack = [
      'Error: Getting importer file',
      `    at getImporterFilePath (${getScriptFilePath()}:60:19)`,
      `    at wrapper (${getScriptFilePath()}:300:1)`,
      '    at Object.<anonymous> (/some/other/file.js:99:1)',
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterFilePath()).toBe('/some/other/file.js');
    });
  });

  test('falls back to process.argv[1] when no frame matches', () => {
    const stack = [
      'Error: Getting importer file',
      `    at getImporterFilePath (${getScriptFilePath()}:60:19)`,
      '    junk frame with no location',
    ].join('\n');

    withStack(stack, () => {
      expect(getImporterFilePath()).toBe(globalThis.process.argv[1] ?? '');
    });
  });

  test('falls back to an empty string when neither a frame nor process.argv[1] is available', () => {
    const stack = [
      'Error: Getting importer file',
      `    at getImporterFilePath (${getScriptFilePath()}:60:19)`,
      '    junk frame with no location',
    ].join('\n');

    vi.stubGlobal('process', { ...globalThis.process, argv: [globalThis.process.argv[0] ?? ''] });
    try {
      withStack(stack, () => {
        expect(getImporterFilePath()).toBe('');
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('getCallerFilePath fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('falls back to an empty string when process.argv[1] is unset', () => {
    vi.stubGlobal('process', { ...globalThis.process, argv: [globalThis.process.argv[0] ?? ''] });
    expect(getCallerFilePath()).toBe('');
  });
});

describe('stack unavailable (Error.stack is undefined)', () => {
  test('getImporterDir falls back to the current working directory', () => {
    const original = getPrepareStackTraceDescriptor();
    Error.prepareStackTrace = () => undefined;
    try {
      expect(getImporterDir()).toBe(globalThis.process.cwd());
    } finally {
      Object.defineProperty(Error, 'prepareStackTrace', original);
    }
  });

  test('getImporterFilePath falls back to process.argv[1]', () => {
    const original = getPrepareStackTraceDescriptor();
    Error.prepareStackTrace = () => undefined;
    try {
      expect(getImporterFilePath()).toBe(globalThis.process.argv[1] ?? '');
    } finally {
      Object.defineProperty(Error, 'prepareStackTrace', original);
    }
  });
});

describe('readFile - encoding branch', () => {
  test('passes undefined encoding through to fs.readFileSync when encoding is explicitly null', () => {
    const filePath = path.join(tempDir, 'binary.txt');
    fs.writeFileSync(filePath, 'raw bytes');

    const result = readFile({ encoding: null, path: filePath });

    expect(globalThis.Buffer.isBuffer(result)).toBe(true);
    if (globalThis.Buffer.isBuffer(result)) {
      expect(result.toString('utf8')).toBe('raw bytes');
    }
  });
});

describe('createFile - additional branches', () => {
  test('silently does nothing when the file exists, replace is false, and throwError is false', () => {
    const filePath = path.join(tempDir, 'existing-no-throw.txt');
    fs.writeFileSync(filePath, 'original');

    expect(() => {
      createFile({ content: 'ignored', path: filePath, replace: false, throwError: false });
    }).not.toThrow();
    expect(fs.readFileSync(filePath, 'utf8')).toBe('original');
  });

  test('passes undefined encoding through to fs.writeFileSync when encoding is explicitly null', () => {
    const filePath = path.join(tempDir, 'null-encoding.txt');
    createFile({ content: 'hello', encoding: null, path: filePath });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('hello');
  });

  test('defaults content to an empty string when not provided', () => {
    const filePath = path.join(tempDir, 'no-content.txt');
    createFile({ path: filePath });
    expect(fs.readFileSync(filePath, 'utf8')).toBe('');
  });
});

describe('movePath - replace branch', () => {
  test('deletes the existing destination first when replace is true', () => {
    const source = path.join(tempDir, 'move-source.txt');
    const destination = path.join(tempDir, 'move-destination.txt');
    fs.writeFileSync(source, 'new content');
    fs.writeFileSync(destination, 'old content');

    movePath({
      destinationPath: destination,
      replace: true,
      sourcePath: source,
      throwError: false,
    });

    expect(pathExists(source)).toBe(false);
    expect(fs.readFileSync(destination, 'utf8')).toBe('new content');
  });
});
