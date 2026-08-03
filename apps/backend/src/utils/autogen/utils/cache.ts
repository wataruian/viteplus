import { Project } from 'ts-morph';

class ProjectCache {
  private readonly cacheValidityMs: number = 5 * 60 * 1000;
  private lastCacheTime = 0;
  private projectCache: Project | undefined;

  public clearCache(): void {
    this.projectCache = undefined;
    this.lastCacheTime = 0;
  }

  public getCacheStats(): {
    cacheAge: number;
    cached: boolean;
    validFor: number;
  } {
    const now = Date.now();
    const cacheAge = now - this.lastCacheTime;
    const validFor = Math.max(0, this.cacheValidityMs - cacheAge);

    return {
      cacheAge,
      cached: Boolean(this.projectCache),
      validFor,
    };
  }

  public getProject(): Project {
    const now = Date.now();

    if (this.projectCache && now - this.lastCacheTime < this.cacheValidityMs) {
      return this.projectCache;
    }

    this.projectCache = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
      tsConfigFilePath: 'tsconfig.json',
      useInMemoryFileSystem: false,
    });

    this.projectCache.addSourceFilesAtPaths(['src/**/*.ts']);

    this.lastCacheTime = now;
    return this.projectCache;
  }
}

class FileParsingCache {
  private readonly fileCache = new Map<string, { content: string; mtime: number }>();

  public cacheFile(filePath: string, content: string, mtime: number): void {
    this.fileCache.set(filePath, { content, mtime });
  }

  public clearCache(): void {
    this.fileCache.clear();
  }

  public getCachedContent(filePath: string): string | undefined {
    return this.fileCache.get(filePath)?.content;
  }

  public getCacheStats(): {
    cachedFiles: number;
    totalSizeKb: number;
  } {
    let totalSize = 0;
    for (const { content } of this.fileCache.values()) {
      totalSize += content.length;
    }

    return {
      cachedFiles: this.fileCache.size,
      totalSizeKb: Math.round(totalSize / 1024),
    };
  }

  public needsUpdate(filePath: string, currentMtime: number): boolean {
    const cached = this.fileCache.get(filePath);
    return !cached || cached.mtime < currentMtime;
  }
}

const projectCache = new ProjectCache();
const fileParsingCache = new FileParsingCache();

export { ProjectCache, FileParsingCache, projectCache, fileParsingCache };
