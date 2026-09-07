import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';

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
