import { describe, expect, it } from 'vite-plus/test';
import {
  extractServiceMetadata,
  getRouteHandlerFilePath,
  getServiceNameFromHandlerFile,
  toPascalCase,
} from '../../../src/utils/autogen/parsers/service-parser';

describe('Service Parser', () => {
  const messageOutput = [{ name: 'message', required: true, type: 'string' }] as const;

  const errorOutput = [
    {
      name: 'error',
      required: true,
      type: '{ message: string; name: string; stack: string; statusCode: number; }',
    },
    ...messageOutput,
  ] as const;

  const expectedServiceMethods = [
    {
      input: [
        { name: '_stringInput', required: false, type: 'string' },
        { name: '_stringArrayInput', required: false },
        { name: '_numberInput', required: false, type: 'number' },
        { name: '_numberArrayInput', required: false },
        { name: '_booleanInput', required: false, type: 'boolean' },
        { name: '_booleanArrayInput', required: false },
        { name: '_objectStringInput', required: false, type: '{ string: string; }' },
        { name: '_objectStringArrayInput', required: false },
        { name: '_objectNumberInput', required: false, type: '{ number: number; }' },
        { name: '_objectNumberArrayInput', required: false },
        { name: '_objectBooleanInput', required: false, type: '{ boolean: boolean; }' },
        { name: '_objectBooleanArrayInput', required: false },
        { name: '_objectMultipleInput', required: false },
        { name: '_string', required: false, type: 'string' },
        { name: '_stringArray', required: false },
      ],
      method: '_checkParams',
      output: [
        {
          name: 'data',
          required: true,
          type: '{ booleanArrayOutput: {}; booleanOutput: boolean; numberArrayOutput: {}; numberOutput: number; objectBooleanArrayOutput: { booleanArray: {}; }; objectBooleanOutput: { boolean: boolean; }; objectMultipleOutput: { boolean: boolean; booleanArray: {}; number: number; numberArray: {}; object: { boolean: boolean; booleanArray: {}; number: number; numberArray: {}; string: string; stringArray: {}; }; objectArray: {}; string: string; stringArray: {}; }; objectNumberArrayOutput: { numberArray: {}; }; objectNumberOutput: { number: number; }; objectStringArrayOutput: { stringArray: {}; }; objectStringOutput: { string: string; }; stringArrayOutput: {}; stringOutput: string; }',
        },
        ...messageOutput,
      ],
    },
    {
      input: [],
      method: 'asyncFailReject',
      output: errorOutput,
    },
    {
      input: [],
      method: 'asyncFailThrow',
      output: errorOutput,
    },
    {
      input: [],
      method: 'asyncSuccess',
      output: messageOutput,
    },
    {
      input: [
        { name: 'firstName', required: true, type: 'string' },
        { name: 'lastName', required: false, type: 'string | undefined' },
      ],
      method: 'hello',
      output: messageOutput,
    },
    {
      input: [
        { name: 'a', required: true, type: 'string' },
        { name: 'b', required: true, type: 'number' },
        { name: 'options', required: false, type: '{ bar?: number; foo?: string; } | undefined' },
        { name: 'arr', required: false },
      ],
      method: 'mixedParams',
      output: [
        {
          name: 'data',
          required: true,
          type: '{ a: string; arr: {} | undefined; b: number; options: { bar?: number; foo?: string; } | undefined; }',
        },
        ...messageOutput,
      ],
    },
    {
      input: [
        { name: '{ prop1, prop2 }', required: true, type: '{ prop1?: string; prop2?: number; }' },
      ],
      method: 'objectDestructured',
      output: [
        {
          name: 'data',
          required: true,
          type: '{ prop1: string | undefined; prop2: number | undefined; }',
        },
        ...messageOutput,
      ],
    },
    {
      input: [{ name: 'options', required: true, type: '{ bar?: number; foo?: string; }' }],
      method: 'objectOnly',
      output: [
        { name: 'data', required: true, type: '{ bar?: number; foo?: string; }' },
        ...messageOutput,
      ],
    },
    {
      input: [
        { name: 'var1', required: true, type: 'string' },
        { name: 'var2', required: true, type: 'number' },
        { name: 'var3', required: false },
      ],
      method: 'primitivesAndArray',
      output: [
        {
          name: 'data',
          required: true,
          type: '{ var1: string; var2: number; var3: {} | undefined; }',
        },
        ...messageOutput,
      ],
    },
    {
      input: [],
      method: 'syncFailReject',
      output: errorOutput,
    },
    {
      input: [],
      method: 'syncFailThrow',
      output: errorOutput,
    },
    {
      input: [],
      method: 'syncSuccess',
      output: messageOutput,
    },
  ] as const;

  const expectedDefaultServiceMethods = [
    {
      input: [],
      method: 'root',
      output: messageOutput,
    },
  ] as const;

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
      const metadata = await extractServiceMetadata('DefaultService', 'root');

      expect(metadata).toHaveProperty('serviceFilePath');
      expect(metadata).toHaveProperty('input');

      if (metadata.serviceFilePath !== undefined && metadata.serviceFilePath !== '') {
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
    });

    it.each(expectedServiceMethods)(
      'should extract correct input and output shape for TestService.$method',
      async ({ input, method, output }) => {
        const metadata = await extractServiceMetadata('TestService', method);

        expect(metadata).toBeDefined();

        const extractedInput = metadata.input ?? [];
        expect(extractedInput).toHaveLength(input.length);
        for (const expectedParam of input) {
          const found = extractedInput.find((p) => p.name === expectedParam.name);
          expect(found, `input param '${expectedParam.name}'`).toBeDefined();
          if (found) {
            if ('type' in expectedParam) {
              expect(found.type).toBe(expectedParam.type);
            }
            expect(found.required).toBe(expectedParam.required);
          }
        }

        const extractedOutput = metadata.output ?? [];
        expect(extractedOutput).toHaveLength(output.length);
        for (const expectedField of output) {
          const found = extractedOutput.find((f) => f.name === expectedField.name);
          expect(found, `output field '${expectedField.name}'`).toBeDefined();
          if (found) {
            if ('type' in expectedField) {
              expect(found.type).toBe(expectedField.type);
            }
            expect(found.required).toBe(expectedField.required);
          }
        }
      },
    );

    it.each(expectedDefaultServiceMethods)(
      'should extract correct input and output shape for DefaultService.$method',
      async ({ input, method, output }) => {
        const metadata = await extractServiceMetadata('DefaultService', method);

        expect(metadata).toBeDefined();

        const extractedInput = metadata.input ?? [];
        expect(extractedInput).toHaveLength(input.length);

        const extractedOutput = metadata.output ?? [];
        expect(extractedOutput).toHaveLength(output.length);
        for (const expectedField of output) {
          const found = extractedOutput.find((f) => f.name === expectedField.name);
          expect(found, `output field '${expectedField.name}'`).toBeDefined();
          if (found) {
            if ('type' in expectedField) {
              expect(found.type).toBe(expectedField.type);
            }
            expect(found.required).toBe(expectedField.required);
          }
        }
      },
    );

    it('should never produce unknown output types across all tested methods', async () => {
      const methods = [
        ...expectedServiceMethods.map((m) => ({
          method: m.method,
          serviceName: 'TestService' as const,
        })),
        ...expectedDefaultServiceMethods.map((m) => ({
          method: m.method,
          serviceName: 'DefaultService' as const,
        })),
      ];
      const metadatas = await Promise.all(
        methods.map(async ({ method, serviceName }) => {
          const metadata = await extractServiceMetadata(serviceName, method);
          return { metadata, method, serviceName };
        }),
      );
      for (const { metadata, method, serviceName } of metadatas) {
        const output = metadata.output ?? [];
        for (const field of output) {
          expect(
            field.type,
            `${serviceName}.${method} output field '${field.name}' should not be unknown`,
          ).not.toBe('unknown');
        }
      }
    });
  });

  describe('Integration tests', () => {
    it('should work with real service files', async () => {
      const serviceNames = ['DefaultService', 'TestService'];

      const results = await Promise.all(
        serviceNames.map(async (serviceName) => {
          const metadata = await extractServiceMetadata(serviceName, 'root');
          return metadata;
        }),
      );

      for (const metadata of results) {
        expect(metadata).toBeDefined();
      }
    });

    it('should handle service method discovery', async () => {
      const testMethods = expectedServiceMethods.map((m) => m.method);

      const results = await Promise.all(
        testMethods.map(async (method) => {
          const metadata = await extractServiceMetadata('TestService', method);
          return metadata;
        }),
      );

      for (const metadata of results) {
        expect(metadata).toBeDefined();

        if (metadata.serviceFilePath !== undefined && metadata.serviceFilePath !== '') {
          expect(metadata.serviceFilePath).toMatch(/test\.ts$/);
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle TypeScript parsing errors gracefully', async () => {
      const metadata = await extractServiceMetadata('TestService', 'someMethod');
      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('serviceFilePath');
      expect(metadata).toHaveProperty('input');
    });

    it('should handle file system errors gracefully', async () => {
      const metadata = await extractServiceMetadata('FileSystemErrorService', 'test');
      expect(metadata).toEqual({
        input: undefined,
        serviceFilePath: undefined,
      });
    });
  });
});
