# Using Param-Parser from Common Library

## Quick Import

```typescript
import type { ParameterInfo, ParameterMetadata } from '@lightproject/common';
import { paramParser } from '@lightproject/common/utils';
```

## Type Definitions

### ParameterInfo (Runtime - Lightweight)

```typescript
interface ParameterInfo {
  name: string;
}
```

Used by: `invoker.extractParamNamesAndDefaults()` at runtime for fast parameter extraction.

### ParameterMetadata (Build-time - Rich)

```typescript
interface ParameterMetadata extends ParameterInfo {
  name: string; // From invoker (guaranteed runtime match)
  type: string; // From AST (TypeScript type)
  required: boolean; // From AST (! optional marker)
  defaultValue?: any; // From AST (initializer)
  description?: string; // From JSDoc (@param tag)
  properties?: ParameterMetadata[]; // For nested object params
}
```

Used by: `paramParser.extractParameterMetadata()` at build-time for documentation generation.

## API

### `extractParameterMetadata()`

Extract complete parameter metadata using hybrid approach (invoker + AST).

**Signature:**

```typescript
async function extractParameterMetadata(
  methodDecl: MethodDeclaration, // ts-morph method declaration
  serviceFilePath: string, // Absolute path to service file
  serviceClassName: string, // Name of service class
  methodName: string // Name of method
): Promise<ParameterMetadata[]>;
```

**Example:**

```typescript
import { Project } from 'ts-morph';
import { paramParser } from '@lightproject/common/utils';

const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFile = project.getSourceFile('./src/services/user.ts');
const classDecl = sourceFile?.getClass('UserService');
const methodDecl = classDecl?.getMethod('createUser');

if (methodDecl) {
  const params = await paramParser.extractParameterMetadata(
    methodDecl,
    './src/services/user.ts',
    'UserService',
    'createUser'
  );

  console.log(params);
  // [
  //   {
  //     name: 'username',
  //     type: 'string',
  //     required: true,
  //     description: 'The username for the new user'
  //   },
  //   {
  //     name: 'options',
  //     type: '{ email?: string; role?: string }',
  //     required: false,
  //     defaultValue: {},
  //     description: 'Additional user options'
  //   }
  // ]
}
```

## How It Works

1. **Step 1**: Dynamic import of service file to get runtime function
2. **Step 2**: Extract parameter names via `invoker.extractParamNamesAndDefaults()` (TRUTH SOURCE)
3. **Step 3**: Get TypeScript type info via ts-morph AST traversal
4. **Step 4**: Merge invoker names + AST metadata + JSDoc descriptions
5. **Fallback**: If runtime import fails, falls back to AST-only extraction

## Why Hybrid Approach?

- **Runtime consistency**: Invoker ensures parameter names match what the code actually receives
- **Rich metadata**: AST provides TypeScript types, optionality, defaults, JSDoc
- **Single source of truth**: Invoker is used by both runtime (route-handler) and build-time (param-parser)
- **No divergence**: Can't have different parameter extraction logic causing inconsistencies

## Use Cases

### 1. Documentation Generation (Autogen)

```typescript
// apps/api/src/utils/autogen.ts
const params = await paramParser.extractParameterMetadata(
  methodDecl,
  serviceFilePath,
  serviceClass,
  serviceMethod
);

routes.push({
  path: '/api/users/create',
  input: params, // Full ParameterMetadata[]
  // ...
});
```

### 2. OpenAPI/Swagger Schema Generation

```typescript
const params = await paramParser.extractParameterMetadata(...);

const openApiParams = params.map(p => ({
  name: p.name,
  in: 'body',
  required: p.required,
  schema: { type: mapTypeScriptToOpenApi(p.type) },
  description: p.description,
}));
```

### 3. CLI Help Text Generation

```typescript
const params = await paramParser.extractParameterMetadata(...);

console.log(`Usage: mycommand ${params.map(p =>
  p.required ? `<${p.name}>` : `[${p.name}]`
).join(' ')}`);

params.forEach(p => {
  console.log(`  ${p.name}: ${p.description} (${p.type})`);
});
```

### 4. GraphQL Schema Generation

```typescript
const params = await paramParser.extractParameterMetadata(...);

const graphqlArgs = params.reduce((acc, p) => {
  acc[p.name] = {
    type: mapTypeScriptToGraphQL(p.type),
    description: p.description,
  };
  return acc;
}, {});
```

## Caveats

1. **ts-morph required**: Must have ts-morph installed and TypeScript project configured
2. **Async operation**: Uses dynamic import, always await the result
3. **Service conventions**: Expects services to be instantiable with `(ctx, inputArgs)` constructor
4. **Fallback behavior**: If runtime import fails, falls back to AST-only (loses runtime consistency guarantee)

## Dependencies

The common library must have these dependencies:

- `ts-morph`: For AST traversal
- Peer dependency on TypeScript project with tsconfig.json

## Installation

Already included in `@lightproject/common`. Just import and use:

```bash
# No additional installation needed
pnpm install  # At monorepo root
```

## Related Utilities

- `invoker.extractParamNamesAndDefaults()`: Runtime parameter name extraction (lightweight)
- `invoker.normalizeArgs()`: Convert input to positional arguments
- `invoker.invokeWithParsedArgs()`: Extract + normalize + invoke in one call

## Migration Notes

If you were previously using:

```typescript
import { extractParameterMetadata } from './autogen/param-parser';
```

Update to:

```typescript
import { paramParser } from '@lightproject/common/utils';
const params = await paramParser.extractParameterMetadata(...);
```
