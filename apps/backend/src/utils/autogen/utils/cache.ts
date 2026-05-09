import { Project } from 'ts-morph';

/**
 * Cache configuration constants
 */
const CACHE_VALIDITY_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const BYTES_TO_KB = 1024;

/**
 * Cache for ts-morph Project instances to avoid recreating them
 */
class ProjectCache {
  private readonly cacheValidityMs: number =
    CACHE_VALIDITY_MINUTES * MINUTES_TO_MS;
  private lastCacheTime = 0;
  private projectCache: Project | undefined;

  /**
   * Clear the project cache to free memory
   */
  clearCache(): void {
    this.projectCache = undefined;
    this.lastCacheTime = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
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

  /**
   * Get or create a cached ts-morph Project instance
   */
  getProject(): Project {
    const now = Date.now();

    // Check if we have a valid cached project
    if (this.projectCache && now - this.lastCacheTime < this.cacheValidityMs) {
      return this.projectCache;
    }

    // Create new project with optimized settings
    this.projectCache = new Project({
      // Only load what we need for better performance
      skipAddingFilesFromTsConfig: false,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
      tsConfigFilePath: 'tsconfig.json',
      useInMemoryFileSystem: false,
    });

    this.lastCacheTime = now;
    return this.projectCache;
  }
}

/**
 * File parsing cache to avoid re-parsing the same files
 */
class FileParsingCache {
  private readonly fileCache: Map<string, { content: string; mtime: number }> =
    new Map();

  /**
   * Cache file content with its modification time
   */
  cacheFile(filePath: string, content: string, mtime: number): void {
    this.fileCache.set(filePath, { content, mtime });
  }

  /**
   * Clear the file cache
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * Get cached file content
   */
  getCachedContent(filePath: string): string | undefined {
    return this.fileCache.get(filePath)?.content;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedFiles: number;
    totalSizeKb: number;
  } {
    let totalSize = 0;
    for (const { content } of this.fileCache.values()) {
      totalSize += content.length;
    }

    return {
      cachedFiles: this.fileCache.size,
      totalSizeKb: Math.round(totalSize / BYTES_TO_KB),
    };
  }

  /**
   * Check if a file needs to be re-parsed based on modification time
   */
  needsUpdate(filePath: string, currentMtime: number): boolean {
    const cached = this.fileCache.get(filePath);
    return !cached || cached.mtime < currentMtime;
  }
}

/**
 * Global cache instances
 */
export const projectCache = new ProjectCache();
export const fileParsingCache = new FileParsingCache();
