import { expect, test } from 'vite-plus/test';
import { Project } from 'ts-morph';
import { extractReturnTypeMetadata } from '../src/utils/param-parser';

test('returns an object-shaped output schema for object returns', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(
    'service.ts',
    `
      class ExampleService {
        async asyncSuccess() {
          return Promise.resolve({ data: 1, message: 'ok' });
        }
      }
    `,
  );

  const methodDecl = sourceFile.getClassOrThrow('ExampleService').getMethodOrThrow('asyncSuccess');
  const metadata = extractReturnTypeMetadata(methodDecl);

  expect(metadata).toMatchObject({
    name: 'output',
    required: true,
    type: {
      kind: 'object',
      properties: {
        data: expect.anything(),
        message: expect.anything(),
      },
    },
  });
});

test('serializes nested object values from identifiers as object schemas', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(
    'service.ts',
    `
      class ExampleService {
        async asyncSuccess() {
          const payload = { prop1: 'hello', prop2: 42 };
          return Promise.resolve({ data: payload, message: 'ok' });
        }
      }
    `,
  );

  const methodDecl = sourceFile.getClassOrThrow('ExampleService').getMethodOrThrow('asyncSuccess');
  const metadata = extractReturnTypeMetadata(methodDecl);

  expect(metadata).toMatchObject({
    name: 'output',
    required: true,
    type: {
      kind: 'object',
      properties: {
        data: {
          kind: 'object',
          properties: {
            prop1: { base: 'string', kind: 'primitive' },
            prop2: { base: 'number', kind: 'primitive' },
          },
        },
        message: { base: 'string', kind: 'primitive' },
      },
    },
  });
});

test('serializes optional array parameters referenced in returned objects as arrays', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(
    'service.ts',
    `
      class ExampleService {
        async asyncSuccess(arr?: number[]) {
          return Promise.resolve({ data: { arr }, message: 'ok' });
        }
      }
    `,
  );

  const methodDecl = sourceFile.getClassOrThrow('ExampleService').getMethodOrThrow('asyncSuccess');
  const metadata = extractReturnTypeMetadata(methodDecl);

  expect(metadata).toMatchObject({
    name: 'output',
    required: true,
    type: {
      kind: 'object',
      properties: {
        data: {
          kind: 'object',
          properties: {
            arr: {
              itemType: {
                base: 'number',
                kind: 'primitive',
              },
              kind: 'array',
            },
          },
        },
        message: { base: 'string', kind: 'primitive' },
      },
    },
  });
});

test('serializes literal array values as arrays with element types', () => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
    useInMemoryFileSystem: true,
  });
  const sourceFile = project.createSourceFile(
    'service.ts',
    `
      class ExampleService {
        async asyncSuccess() {
          return Promise.resolve({ booleanArrayOutput: [true, false] });
        }
      }
    `,
  );

  const methodDecl = sourceFile.getClassOrThrow('ExampleService').getMethodOrThrow('asyncSuccess');
  const metadata = extractReturnTypeMetadata(methodDecl);

  expect(metadata).toMatchObject({
    name: 'output',
    required: true,
    type: {
      kind: 'object',
      properties: {
        booleanArrayOutput: {
          itemType: {
            base: 'boolean',
            kind: 'primitive',
          },
          kind: 'array',
        },
      },
    },
  });
});
