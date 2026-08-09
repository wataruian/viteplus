import {
  RouteValidator,
  type ValidationConfig,
  validateRoutes,
} from '../../../src/utils/autogen/validators/route-validator';
import { describe, expect, it } from 'vite-plus/test';
import type { RouteInfo } from '../../../src/utils/autogen/types';

const createMockRoute = (overrides: Partial<RouteInfo> = {}): RouteInfo => ({
  handlerFilePath: '/path/to/handler.ts',
  input: [],
  method: 'get',
  path: '/api/test',
  requestType: 'HTTP',
  serviceClass: 'TestService',
  serviceFilePath: '/src/services/test.ts',
  serviceMethod: 'getTest',
  ...overrides,
});

describe('RouteValidator', () => {
  describe('Basic validation', () => {
    it('should pass validation for well-formed routes', () => {
      const routes: RouteInfo[] = [
        createMockRoute(),
        createMockRoute({
          path: '/trpc/test.hello',
          requestType: 'tRPC',
          type: 'query',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for missing required fields', () => {
      const routes: RouteInfo[] = [
        {
          handlerFilePath: '/path/to/handler.ts',
          path: '',
          requestType: 'HTTP',
        },
        createMockRoute({
          requestType: '',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const pathError = result.errors.find((e) => e.code === 'MISSING_PATH');
      expect(pathError).toBeDefined();

      const requestTypeError = result.errors.find((e) => e.code === 'MISSING_REQUEST_TYPE');
      expect(requestTypeError).toBeDefined();
    });
  });

  describe('Service naming validation', () => {
    it('should validate service class naming conventions', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'InvalidService',
        }),
        createMockRoute({
          serviceClass: 'invalid_service',
        }),
        createMockRoute({
          serviceClass: 'ValidService',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      const namingErrors = result.errors.filter((e) => e.type === 'naming');
      expect(namingErrors.length).toBeGreaterThan(0);
    });

    it('should accept valid service class names', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'TestService',
        }),
        createMockRoute({
          serviceClass: 'UserProfileService',
        }),
        createMockRoute({
          serviceClass: 'DefaultService',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const namingErrors = result.errors.filter((e) => e.type === 'naming');
      expect(namingErrors).toHaveLength(0);
    });

    it('should validate service method naming conventions', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'TestService',
          serviceMethod: 'InvalidMethodName',
        }),
        createMockRoute({
          serviceClass: 'TestService',
          serviceMethod: 'invalid_method_name',
        }),
        createMockRoute({
          serviceClass: 'TestService',
          serviceMethod: '_privateMethod',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const methodWarnings = result.warnings.filter((w) => w.code === 'INVALID_METHOD_NAMING');
      expect(methodWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Path format validation', () => {
    it('should validate HTTP path formats', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          path: '/trpc/something',
          requestType: 'HTTP',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      const pathError = result.errors.find((e) => e.code === 'INVALID_HTTP_PATH');
      expect(pathError).toBeDefined();
    });

    it('should validate tRPC path formats', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          path: '/api/something',
          requestType: 'tRPC',
        }),
        createMockRoute({
          path: '/trpc/invalid-format',
          requestType: 'tRPC',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      const trpcPathError = result.errors.find((e) => e.code === 'INVALID_TRPC_PATH');
      expect(trpcPathError).toBeDefined();

      const dotNotationWarning = result.warnings.find(
        (w) => w.code === 'MISSING_TRPC_DOT_NOTATION',
      );
      expect(dotNotationWarning).toBeDefined();
    });

    it('should accept valid path formats', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          path: '/api/users',
          requestType: 'HTTP',
        }),
        createMockRoute({
          path: '/trpc/user.getProfile',
          requestType: 'tRPC',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
    });
  });

  describe('File structure validation', () => {
    it('should validate service file locations', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceFilePath: '/wrong/location/test.ts',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      const locationError = result.errors.find((e) => e.code === 'INVALID_SERVICE_LOCATION');
      expect(locationError).toBeDefined();
    });

    it('should warn about mismatched service filenames', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'UserProfileService',
          serviceFilePath: '/src/services/wrong-name.ts',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const filenameWarning = result.warnings.find((w) => w.code === 'MISMATCHED_SERVICE_FILENAME');
      expect(filenameWarning).toBeDefined();
    });
  });

  describe('Convention validation', () => {
    it('should validate createRouteHandler pattern usage', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: undefined,
          serviceMethod: undefined,
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(false);
      const patternError = result.errors.find((e) => e.code === 'MISSING_ROUTE_HANDLER_PATTERN');
      expect(patternError).toBeDefined();
    });

    it('should validate HTTP method consistency', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          method: 'get',
          serviceMethod: 'createUser',
        }),
        createMockRoute({
          method: 'post',
          serviceMethod: 'getUser',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const methodWarnings = result.warnings.filter((w) => w.code === 'HTTP_METHOD_MISMATCH');
      expect(methodWarnings.length).toBe(2);
    });

    it('should validate tRPC procedure type consistency', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          path: '/trpc/user.createUser',
          requestType: 'tRPC',
          serviceClass: 'UserService',
          serviceMethod: 'createUser',
          type: 'query',
        }),
        createMockRoute({
          path: '/trpc/user.getUser',
          requestType: 'tRPC',
          serviceClass: 'UserService',
          serviceMethod: 'getUser',
          type: 'mutation',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const procedureWarnings = result.warnings.filter((w) => w.code === 'TRPC_PROCEDURE_MISMATCH');
      expect(procedureWarnings.length).toBe(2);
    });
  });

  describe('Configuration options', () => {
    it('should respect enforceServiceNaming option', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'InvalidNaming',
        }),
      ];

      const configWithoutEnforcement: Partial<ValidationConfig> = {
        enforceServiceNaming: false,
      };

      const result = validateRoutes(routes, configWithoutEnforcement);

      const serviceSuffixErrors = result.errors.filter((e) => e.code === 'INVALID_SERVICE_SUFFIX');
      expect(serviceSuffixErrors).toHaveLength(0);
    });

    it('should respect strictConventions option', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: undefined,
          serviceMethod: undefined,
        }),
      ];

      const configWithoutStrictness: Partial<ValidationConfig> = {
        strictConventions: false,
      };

      const result = validateRoutes(routes, configWithoutStrictness);

      const patternErrors = result.errors.filter((e) => e.code === 'MISSING_ROUTE_HANDLER_PATTERN');
      expect(patternErrors).toHaveLength(0);
    });

    it('should use custom service directory', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceFilePath: '/custom/services/test.ts',
        }),
      ];

      const configWithCustomDirectory: Partial<ValidationConfig> = {
        requiredServiceDirectory: '/custom/services/',
      };

      const result = validateRoutes(routes, configWithCustomDirectory);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Utility functions', () => {
    it('should provide comprehensive error summary', () => {
      const validator = new RouteValidator();
      const routes: RouteInfo[] = [
        {
          handlerFilePath: '/path/to/handler.ts',
          path: '',
          requestType: 'HTTP',
          serviceMethod: 'InvalidMethodName',
        },
      ];

      const result = validator.validate(routes);
      const summary = RouteValidator.getSummary(result);

      expect(summary).toContain('3 issues found');
      expect(summary).toContain('❌ Errors: 2');
      expect(summary).toContain('MISSING_PATH');
    });

    it('should handle empty route list', () => {
      const result = validateRoutes([]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate service filename patterns indirectly', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'UserProfileService',
          serviceFilePath: '/src/services/user-profile.ts',
        }),
        createMockRoute({
          serviceClass: 'TestService',
          serviceFilePath: '/src/services/test.ts',
        }),
      ];

      const result = validateRoutes(routes);

      expect(result.isValid).toBe(true);
      const filenameWarnings = result.warnings.filter(
        (w) => w.code === 'MISMATCHED_SERVICE_FILENAME',
      );
      expect(filenameWarnings).toHaveLength(0);
    });
  });

  describe('Error types and categorization', () => {
    it('should properly categorize validation errors', () => {
      const routes: RouteInfo[] = [
        {
          handlerFilePath: '/path/to/handler.ts',
          path: '',
          requestType: 'HTTP',
          serviceClass: 'invalid',
          serviceFilePath: '/wrong/path/test.ts',
        },
      ];

      const result = validateRoutes(routes);

      const structureErrors = result.errors.filter((e) => e.type === 'structure');
      const namingErrors = result.errors.filter((e) => e.type === 'naming');

      expect(structureErrors.length).toBeGreaterThan(0);
      expect(namingErrors.length).toBeGreaterThan(0);
    });

    it('should include helpful suggestions in error messages', () => {
      const routes: RouteInfo[] = [
        createMockRoute({
          serviceClass: 'TestName',
        }),
      ];

      const result = validateRoutes(routes);

      const suffixError = result.errors.find((e) => e.code === 'INVALID_SERVICE_SUFFIX');
      expect(suffixError).toBeDefined();
      expect(suffixError?.suggestion).toContain('TestNameService');
    });
  });
});
