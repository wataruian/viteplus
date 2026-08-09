import type { ParsedType, ServiceMetadata } from '../types';
import { getProject, servicesDir } from '../config';
import { createBaseResponseSchema } from '../../route-handler';
import { isRecord } from '@lightproject/common/validators';
import { toPascalCase } from '@lightproject/common/utils';
import { z } from 'zod';
import { zodToParsedType } from '../utils/zod';

const extractSchemas = (
  serviceModule: unknown,
  serviceClass: string,
  serviceMethod: string,
): { inputType: ParsedType | undefined; outputType: ParsedType | undefined } => {
  if (!isRecord(serviceModule)) {
    throw new Error('Service module is not a record');
  }

  const inputSchemasName = `${serviceClass}InputSchemas`;
  const outputSchemasName = `${serviceClass}OutputSchemas`;

  const rawInputSchemas = serviceModule[inputSchemasName];
  const rawOutputSchemas = serviceModule[outputSchemasName];

  const inputSchemas = isRecord(rawInputSchemas) ? rawInputSchemas : undefined;
  const outputSchemas = isRecord(rawOutputSchemas) ? rawOutputSchemas : undefined;

  let inputType: ParsedType | undefined = undefined;
  if (inputSchemas && serviceMethod in inputSchemas) {
    const schema = inputSchemas[serviceMethod];
    if (schema instanceof z.ZodType) {
      inputType = zodToParsedType(schema);
    }
  }

  let outputType: ParsedType | undefined = undefined;
  if (outputSchemas && serviceMethod in outputSchemas) {
    const schema = outputSchemas[serviceMethod];
    if (schema instanceof z.ZodType) {
      const outputSchema = createBaseResponseSchema(schema);
      outputType = zodToParsedType(outputSchema);
    }
  }

  return { inputType, outputType };
};

const buildInputParams = (
  inputType?: ParsedType,
): { name: string; type: ParsedType; required: boolean }[] => {
  if (!inputType || inputType.base === 'void') {
    return [];
  }

  if (inputType.kind === 'object' && inputType.properties) {
    const { properties } = inputType;
    return Object.entries(properties).map(([name, type]) => {
      if (typeof type === 'string') {
        throw new TypeError('Type is a string');
      }
      return {
        name,
        required: type.required ?? true,
        type,
      };
    });
  }

  return [
    {
      name: 'payload',
      required: inputType.required ?? true,
      type: inputType,
    },
  ];
};

const extractServiceMetadata = async (
  serviceClass: string | undefined,
  serviceMethod: string | undefined,
): Promise<ServiceMetadata> => {
  if (
    serviceClass === undefined ||
    serviceMethod === undefined ||
    serviceClass === '' ||
    serviceMethod === ''
  ) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const project = getProject();
  const serviceFile = project
    .getSourceFiles(`${servicesDir}/**/*.ts`)
    .find((sf) => sf.getClass(serviceClass));

  if (!serviceFile) {
    return { input: undefined, output: undefined, serviceFilePath: undefined };
  }

  const serviceFilePath = serviceFile.getFilePath();

  try {
    const serviceModule: unknown = await import(serviceFilePath);

    const extracted = extractSchemas(serviceModule, serviceClass, serviceMethod);
    const { inputType } = extracted;
    let { outputType } = extracted;

    outputType ??= zodToParsedType(createBaseResponseSchema());

    const input = buildInputParams(inputType);

    const output: { name: string; type: ParsedType; required: boolean; description: string } = {
      description: 'Response from the service method',
      name: 'return',
      required: outputType.required ?? true,
      type: outputType,
    };

    return { input, output, serviceFilePath };
  } catch {
    // Ignore errors that happen during static schema extraction
    return { input: undefined, output: undefined, serviceFilePath };
  }
};

const getServiceNameFromHandlerFile = (handlerFilePath: string): string | undefined => {
  try {
    const fileName = handlerFilePath.split('/').pop()?.replace('.ts', '');

    if (fileName === undefined || fileName === '') {
      return undefined;
    }

    const pascalCase = toPascalCase(fileName);
    return `${pascalCase}Service`;
  } catch {
    return undefined;
  }
};

export { extractSchemas, buildInputParams, extractServiceMetadata, getServiceNameFromHandlerFile };
