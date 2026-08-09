import type { ParsedType } from '../types';
import { z } from 'zod';

type InferSchemaMap<T extends Record<string, z.ZodType>> = {
  [K in keyof T]: z.infer<T[K]>;
};

const getLiteralBaseType = (type: string): 'string' | 'number' | 'boolean' | 'any' => {
  if (type === 'string') {
    return 'string';
  }
  if (type === 'number') {
    return 'number';
  }
  if (type === 'boolean') {
    return 'boolean';
  }
  return 'any';
};

const zodToParsedType = (schema: z.ZodType): ParsedType => {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    const inner = schema.unwrap();
    if (inner instanceof z.ZodType) {
      const parsed = zodToParsedType(inner);
      return { ...parsed, required: false };
    }
  }

  if (schema instanceof z.ZodString) {
    return { base: 'string', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodNumber) {
    return { base: 'number', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodBoolean) {
    return { base: 'boolean', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodVoid || schema instanceof z.ZodUndefined) {
    return { base: 'void', kind: 'primitive', required: false };
  }

  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return { base: 'any', kind: 'primitive', required: true };
  }

  if (schema instanceof z.ZodArray) {
    const { element } = schema;
    if (element instanceof z.ZodType) {
      return {
        itemType: zodToParsedType(element),
        kind: 'array',
        required: true,
      };
    }
  }

  if (schema instanceof z.ZodObject) {
    const properties: Record<string, ParsedType> = {};
    const shape = schema.shape as Record<string, z.ZodType>;
    for (const [key, propSchema] of Object.entries(shape)) {
      properties[key] = zodToParsedType(propSchema);
    }
    return { kind: 'object', properties, required: true };
  }

  if (schema instanceof z.ZodUnion) {
    return {
      kind: 'union',
      required: true,
      types: schema.options
        .filter((opt: unknown): opt is z.ZodType => opt instanceof z.ZodType)
        .map((opt: z.ZodType) => zodToParsedType(opt)),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return { base: 'string', kind: 'primitive', required: true }; // Treat enums as strings for simplicity
  }

  if (schema instanceof z.ZodLiteral) {
    const type = typeof schema.value;
    return {
      base: getLiteralBaseType(type),
      kind: 'primitive',
      required: true,
    };
  }

  return { base: 'any', kind: 'primitive', required: true };
};

export type { InferSchemaMap };
export { getLiteralBaseType, zodToParsedType };
