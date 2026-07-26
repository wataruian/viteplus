import { describe, expect, it } from 'vite-plus/test';
import {
  extractServiceMetadata,
  getRouteHandlerFilePath,
  getServiceNameFromHandlerFile,
  toPascalCase,
} from '../../../src/utils/autogen/parsers/service-parser';
import type { ParameterMetadata } from '@lightproject/common/types';
import { isParsedType } from '../../../src/utils/autogen/generators/openapi-generator';

const formatTypeToString = (type: unknown): string => {
  if (typeof type === 'string') {
    return type;
  }
  if (type === undefined || type === null || typeof type !== 'object') {
    return 'unknown';
  }
  if (isParsedType(type)) {
    switch (type.kind) {
      case 'primitive': {
        return type.base ?? 'unknown';
      }
      case 'array': {
        return `${formatTypeToString(type.itemType)}[]`;
      }
      case 'union': {
        const unionTypes = type.types ?? [];
        return unionTypes.map((t) => formatTypeToString(t)).join(' | ');
      }
      case 'object': {
        const properties = type.properties ?? {};
        const props = Object.entries(properties).map(([k, v]) => {
          const isOptional = typeof v === 'object' && 'required' in v && !(v.required ?? true);
          return `${k}${isOptional ? '?' : ''}: ${formatTypeToString(v)}`;
        });
        return `{ ${props.join('; ')} }`;
      }
      default: {
        return 'unknown';
      }
    }
  }
  return 'unknown';
};

const normalizeType = (str: string): string =>
  str
    .replaceAll(/\s+/gu, '')
    .replaceAll('\\', '')
    .replaceAll('|undefined', '')
    .replaceAll('?:', ':')
    .replaceAll(';', '')
    .replaceAll(',', '');

const verifyServiceInput = (
  extractedInput: ParameterMetadata[],
  expectedInput: readonly Partial<ParameterMetadata>[],
) => {
  expect(extractedInput).toHaveLength(expectedInput.length);
  for (const expectedParam of expectedInput) {
    let expectedName = expectedParam.name;
    if ((expectedName?.startsWith('{') ?? false) && (expectedName?.endsWith('}') ?? false)) {
      expectedName = 'payload';
    }
    const found = extractedInput.find((p) => p.name === expectedName);
    expect(found, `input param '${expectedParam.name}'`).toBeDefined();
    if (found !== undefined) {
      if ('type' in expectedParam && typeof expectedParam.type === 'string') {
        const formattedFoundType = formatTypeToString(found.type);
        expect(normalizeType(formattedFoundType)).toBe(normalizeType(expectedParam.type));
      }
      if ('required' in expectedParam) {
        expect(found.required).toBe(expectedParam.required);
      }
    }
  }
};

const verifyServiceOutput = (
  extractedOutput: ParameterMetadata | undefined,
  expectedOutput: readonly Partial<ParameterMetadata>[],
) => {
  if (expectedOutput.length > 0) {
    expect(extractedOutput).toBeDefined();
    if (extractedOutput !== undefined) {
      const { type: outputType } = extractedOutput;
      expect(typeof outputType).toBe('object');
      expect(outputType).not.toBeNull();
      if (isParsedType(outputType)) {
        const { properties } = outputType;
        expect(properties).toBeDefined();
        if (properties) {
          for (const expectedField of expectedOutput) {
            const fieldName = expectedField.name;
            if (fieldName !== undefined && fieldName in properties) {
              const found = properties[fieldName];
              expect(found, `output field '${fieldName}'`).toBeDefined();
              if ('type' in expectedField && typeof expectedField.type === 'string') {
                const formattedFoundType = formatTypeToString(found);
                expect(normalizeType(formattedFoundType)).toBe(normalizeType(expectedField.type));
              }
              if ('required' in expectedField) {
                const isRequired =
                  typeof found === 'object' && 'required' in found
                    ? (found.required ?? true)
                    : true;
                expect(isRequired).toBe(expectedField.required);
              }
            }
          }
        }
      }
    }
  } else {
    expect(extractedOutput).toBeUndefined();
  }
};

interface TestParams {
  input: readonly Partial<ParameterMetadata>[];
  method: string;
  output: readonly Partial<ParameterMetadata>[];
}

describe('Service Parser', () => {
  const messageOutput = [
    { name: 'code', required: true, type: 'number' },
    { name: 'message', required: true, type: 'string' },
    { name: 'sessionId', required: true, type: 'string' },
    { name: 'success', required: true, type: 'boolean' },
  ] as const;

  const errorOutput = [
    { name: 'code', required: true, type: 'number' },
    {
      name: 'error',
      required: true,
      type: '{ message: string; name: string; stack: string; statusCode: number; }',
    },
    { name: 'message', required: true, type: 'string' },
    { name: 'sessionId', required: true, type: 'string' },
    { name: 'success', required: true, type: 'boolean' },
  ] as const;

  const expectedServiceMethods: readonly TestParams[] = [
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
          type: '{ booleanArrayOutput: boolean\\[\\]; booleanOutput: boolean; numberArrayOutput: number\\[\\]; numberOutput: number; objectBooleanArrayOutput: { booleanArray: boolean\\[\\]; }; objectBooleanOutput: { boolean: boolean; }; objectMultipleOutput: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; object: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; string: string; stringArray: string\\[\\]; }; objectArray: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; string: string; stringArray: string\\[\\]; }\\[\\]; string: string; stringArray: string\\[\\]; }; objectNumberArrayOutput: { numberArray: number\\[\\]; }; objectNumberOutput: { number: number; }; objectStringArrayOutput: { stringArray: string\\[\\]; }; objectStringOutput: { string: string; }; stringArrayOutput: string\\[\\]; stringOutput: string; }',
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
          type: '{ a: string; arr: number\\[\\] | undefined; b: number; options: { bar?: number; foo?: string; } | undefined; }',
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
        { name: 'data', required: true, type: '{ options: { bar?: number; foo?: string; } }' },
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
          type: '{ var1: string; var2: number; var3: string[] | undefined; }',
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
  ];

  const expectedDefaultServiceMethods: readonly TestParams[] = [
    {
      input: [],
      method: 'root',
      output: messageOutput,
    },
  ];

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
        expect(metadata.serviceFilePath).toMatch(/default\.ts$/u);
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

        const { input: extractedInput = [], output: extractedOutput } = metadata;
        verifyServiceInput(extractedInput, input);
        verifyServiceOutput(extractedOutput, output);
      },
    );

    it.each(expectedDefaultServiceMethods)(
      'should extract correct input and output shape for DefaultService.$method',
      async ({ input, method, output }) => {
        const metadata = await extractServiceMetadata('DefaultService', method);

        expect(metadata).toBeDefined();

        const { input: extractedInput = [], output: extractedOutput } = metadata;
        verifyServiceInput(extractedInput, input);
        verifyServiceOutput(extractedOutput, output);
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
        const { output: extractedOutput } = metadata;
        if (extractedOutput !== undefined) {
          const { type: outputType } = extractedOutput;
          expect(outputType, `${serviceName}.${method} output should not be unknown`).not.toBe(
            'unknown',
          );
          if (isParsedType(outputType)) {
            const { properties } = outputType;
            if (properties) {
              for (const [name, field] of Object.entries(properties)) {
                const fieldType = isParsedType(field) ? field.base : field;
                expect(
                  fieldType,
                  `${serviceName}.${method} output field '${name}' should not be unknown`,
                ).not.toBe('unknown');
              }
            }
          }
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
          expect(metadata.serviceFilePath).toMatch(/test\.ts$/u);
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
