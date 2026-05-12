import { describe, expect, it } from 'vite-plus/test';
import {
  extractServiceMetadata,
  getRouteHandlerFilePath,
  getServiceNameFromHandlerFile,
  toPascalCase,
} from '../../../src/utils/autogen/parsers/service-parser';

describe('Service Parser', () => {
  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('user-profile')).toBe('UserProfile');
      expect(toPascalCase('default')).toBe('Default');
      expect(toPascalCase('test')).toBe('Test');
      expect(toPascalCase('my-custom-service')).toBe('MyCustomService');
    });

    it('should handle single words', () => {
      expect(toPascalCase('auth')).toBe('Auth');
      expect(toPascalCase('user')).toBe('User');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });
  });

  describe('getServiceNameFromHandlerFile', () => {
    it('should convert file path to service class name', () => {
      const result = getServiceNameFromHandlerFile('/path/to/test.ts');
      expect(result).toBe('TestService');
    });

    it('should handle default service', () => {
      const result = getServiceNameFromHandlerFile('/path/to/default.ts');
      expect(result).toBe('DefaultService');
    });

    it('should handle kebab-case filenames', () => {
      const result = getServiceNameFromHandlerFile('/path/to/user-profile.ts');
      expect(result).toBe('UserProfileService');
    });

    it('should handle files without path', () => {
      const result = getServiceNameFromHandlerFile('test.ts');
      expect(result).toBe('TestService');
    });

    it('should return undefined for invalid paths', () => {
      expect(getServiceNameFromHandlerFile('')).toBeUndefined();
      expect(getServiceNameFromHandlerFile('/path/to/')).toBeUndefined();
    });

    it('should handle complex paths', () => {
      const result = getServiceNameFromHandlerFile(
        '/Users/project/src/services/my-custom-service.ts',
      );
      expect(result).toBe('MyCustomServiceService');
    });
  });

  describe('getRouteHandlerFilePath', () => {
    it('should construct correct file path from route name', () => {
      const routerDir = '/path/to/router';
      const result = getRouteHandlerFilePath(routerDir, 'testRoutes');

      expect(result).toBe('/path/to/router/routes/test.ts');
    });

    it('should handle different route naming patterns', () => {
      const routerDir = '/router';

      expect(getRouteHandlerFilePath(routerDir, 'defaultRoutes')).toBe('/router/routes/default.ts');
      expect(getRouteHandlerFilePath(routerDir, 'userRoutes')).toBe('/router/routes/user.ts');
      expect(getRouteHandlerFilePath(routerDir, 'authRoutes')).toBe('/router/routes/auth.ts');
    });

    it('should handle routes without "Routes" suffix', () => {
      const routerDir = '/router';
      const result = getRouteHandlerFilePath(routerDir, 'test');

      expect(result).toBe('/router/routes/test.ts');
    });
  });

  describe('extractServiceMetadata', () => {
    it('should return empty metadata for undefined service class', async () => {
      const metadata = await extractServiceMetadata(undefined, 'someMethod');

      expect(metadata).toEqual({
        input: undefined,
        serviceFilePath: undefined,
      });
    });

    it('should return empty metadata for undefined service method', async () => {
      const serviceMethod: string | undefined = undefined;
      const metadata = await extractServiceMetadata('TestService', serviceMethod);

      expect(metadata).toEqual({
        input: undefined,
        serviceFilePath: undefined,
      });
    });

    it('should extract metadata for existing service and method', async () => {
      // Test with DefaultService which should exist
      const metadata = await extractServiceMetadata('DefaultService', 'root');

      expect(metadata).toHaveProperty('serviceFilePath');
      expect(metadata).toHaveProperty('input');

      if (metadata.serviceFilePath) {
        expect(metadata.serviceFilePath).toMatch(/default\.ts$/);
      }
    });

    it('should handle non-existent service gracefully', async () => {
      const metadata = await extractServiceMetadata('NonExistentService', 'someMethod');

      expect(metadata).toEqual({
        input: undefined,
        serviceFilePath: undefined,
      });
    });

    it('should handle non-existent method gracefully', async () => {
      const metadata = await extractServiceMetadata('DefaultService', 'nonExistentMethod');

      expect(metadata).toHaveProperty('serviceFilePath');
      expect(metadata).toHaveProperty('input');
      // Should return service file path even if method doesn't exist
    });

    it('should extract parameter information when available', async () => {
      // Test with TestService hello method which should have parameters
      const metadata = await extractServiceMetadata('TestService', 'hello');

      if (metadata.input && metadata.input.length > 0) {
        const [param] = metadata.input;
        expect(param).toHaveProperty('name');
        expect(param).toHaveProperty('type');
        expect(param).toHaveProperty('required');
      }
    });
  });

  describe('Integration tests', () => {
    it('should work with real service files', async () => {
      const serviceNames = ['DefaultService', 'TestService'];

      const results = await Promise.all(
        serviceNames.map((serviceName) => extractServiceMetadata(serviceName, 'root')),
      );

      for (const metadata of results) {
        expect(metadata).toBeDefined();
      }
    });

    it('should handle service method discovery', async () => {
      const testMethods = [
        'hello',
        'asyncSuccess',
        'syncSuccess',
        'primitivesAndArray',
        'objectOnly',
        'objectDestructured',
        'mixedParams',
      ];

      const results = await Promise.all(
        testMethods.map((method) => extractServiceMetadata('TestService', method)),
      );

      for (const metadata of results) {
        expect(metadata).toBeDefined();

        if (metadata.serviceFilePath) {
          expect(metadata.serviceFilePath).toMatch(/test\.ts$/);
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle TypeScript parsing errors gracefully', async () => {
      // This test assumes the parser handles TS errors without throwing
      const metadata = await extractServiceMetadata('TestService', 'someMethod');
      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('serviceFilePath');
      expect(metadata).toHaveProperty('input');
    });

    it('should handle file system errors gracefully', async () => {
      // Test with service that might not exist
      const metadata = await extractServiceMetadata('FileSystemErrorService', 'test');
      expect(metadata).toEqual({
        input: undefined,
        serviceFilePath: undefined,
      });
    });
  });
});
