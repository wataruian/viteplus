import type { RouteHandlerInfo, RouteInfo, ServiceMetadata } from '../../src/utils/autogen/types';
import { describe, expect, it } from 'vite-plus/test';

describe('Autogen Types', () => {
  describe('RouteHandlerInfo', () => {
    it('should have correct shape for HTTP route', () => {
      const routeHandler: RouteHandlerInfo = {
        handlerFilePath: '/path/to/handler.ts',
        path: '/api/test',
        serviceClass: 'TestService',
        serviceMethod: 'getTest',
      };

      expect(routeHandler.handlerFilePath).toBe('/path/to/handler.ts');
      expect(routeHandler.path).toBe('/api/test');
      expect(routeHandler.serviceClass).toBe('TestService');
      expect(routeHandler.serviceMethod).toBe('getTest');
    });

    it('should allow undefined service info', () => {
      const routeHandler: RouteHandlerInfo = {
        handlerFilePath: '/path/to/handler.ts',
        path: '/api/test',
        serviceClass: undefined,
        serviceMethod: undefined,
      };

      expect(routeHandler.serviceClass).toBeUndefined();
      expect(routeHandler.serviceMethod).toBeUndefined();
    });
  });

  describe('RouteInfo', () => {
    it('should have correct shape for complete route', () => {
      const route: RouteInfo = {
        handlerFilePath: '/path/to/handler.ts',
        input: [
          {
            defaultValue: undefined,
            description: 'User ID parameter',
            name: 'id',
            required: true,
            type: 'string',
          },
        ],
        method: 'GET',
        output: {
          defaultValue: undefined,
          description: 'Response data',
          name: 'data',
          required: true,
          type: 'object',
        },
        path: '/api/users/:id',
        requestType: 'HTTP',
        serviceClass: 'UserService',
        serviceFilePath: '/path/to/user.service.ts',
        serviceMethod: 'getUser',
        type: 'query',
      };

      expect(route.path).toBe('/api/users/:id');
      expect(route.requestType).toBe('HTTP');
      expect(route.method).toBe('GET');
      expect(route.serviceClass).toBe('UserService');
      expect(route.serviceMethod).toBe('getUser');
      expect(route.input).toHaveLength(1);
      expect(route.output).toBeDefined();
    });

    it('should allow minimal route info', () => {
      const route: RouteInfo = {
        path: '/api/health',
        requestType: 'HTTP',
      };

      expect(route.path).toBe('/api/health');
      expect(route.requestType).toBe('HTTP');
      expect(route.handlerFilePath).toBeUndefined();
      expect(route.input).toBeUndefined();
      expect(route.method).toBeUndefined();
      expect(route.output).toBeUndefined();
      expect(route.serviceClass).toBeUndefined();
      expect(route.serviceFilePath).toBeUndefined();
      expect(route.serviceMethod).toBeUndefined();
      expect(route.type).toBeUndefined();
    });

    it('should support tRPC route info', () => {
      const route: RouteInfo = {
        path: 'user.getProfile',
        requestType: 'tRPC',
        serviceClass: 'UserService',
        serviceMethod: 'getProfile',
        type: 'query',
      };

      expect(route.path).toBe('user.getProfile');
      expect(route.requestType).toBe('tRPC');
      expect(route.type).toBe('query');
    });
  });

  describe('ServiceMetadata', () => {
    it('should have correct shape with parameters', () => {
      const metadata: ServiceMetadata = {
        input: [
          {
            defaultValue: undefined,
            description: 'User name',
            name: 'name',
            required: true,
            type: 'string',
          },
          {
            defaultValue: 18,
            description: 'User age',
            name: 'age',
            required: false,
            type: 'number',
          },
        ],
        output: {
          defaultValue: undefined,
          description: 'User profile data',
          name: 'output',
          required: true,
          type: 'UserProfile',
        },
        serviceFilePath: '/path/to/service.ts',
      };

      expect(metadata.input).toHaveLength(2);
      expect(metadata.input?.[0]?.name).toBe('name');
      expect(metadata.input?.[0]?.required).toBe(true);
      expect(metadata.input?.[1]?.name).toBe('age');
      expect(metadata.input?.[1]?.defaultValue).toBe(18);
      expect(metadata.output).toBeDefined();
      expect(metadata.output?.type).toBe('UserProfile');
      expect(metadata.serviceFilePath).toBe('/path/to/service.ts');
    });

    it('should allow undefined input and service path', () => {
      const metadata: ServiceMetadata = {
        input: undefined,
        output: undefined,
        serviceFilePath: undefined,
      };

      expect(metadata.input).toBeUndefined();
      expect(metadata.output).toBeUndefined();
      expect(metadata.serviceFilePath).toBeUndefined();
    });

    it('should allow empty input array', () => {
      const metadata: ServiceMetadata = {
        input: [],
        output: {
          defaultValue: undefined,
          description: undefined,
          name: 'output',
          required: true,
          type: 'void',
        },
        serviceFilePath: '/path/to/service.ts',
      };

      expect(metadata.input).toEqual([]);
      expect(metadata.input).toHaveLength(0);
      expect(metadata.output).toBeDefined();
    });
  });

  describe('Type compatibility', () => {
    it('should support parameter metadata structure', () => {
      const route: RouteInfo = {
        input: [
          {
            defaultValue: 'default',
            description: 'Test parameter',
            name: 'test',
            required: false,
            type: 'string',
          },
        ],
        path: '/test',
        requestType: 'HTTP',
      };

      const parameter = route.input?.[0];
      expect(parameter?.name).toBe('test');
      expect(parameter?.type).toBe('string');
      expect(parameter?.required).toBe(false);
      expect(parameter?.defaultValue).toBe('default');
      expect(parameter?.description).toBe('Test parameter');
    });
  });
});
