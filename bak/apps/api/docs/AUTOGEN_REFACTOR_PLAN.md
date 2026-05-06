# Autogen Refactoring Plan

## Executive Summary

**Goal**: Refactor `autogen.ts` to use `invoker.ts` for parameter extraction, eliminating duplication and ensuring runtime/static analysis consistency.

**Current State**:

- Autogen: ~600 lines, duplicated logic, AST-based parameter parsing
- Invoker: ~120 lines, runtime reflection, well-tested
- **Problem**: Two different ways to extract the same parameter information

**Target State**:

- Unified parameter extraction via invoker
- Modular architecture: discovery → parsing → generation
- OpenAPI spec output capability
- Validation & error reporting

---

## Analysis: Invoker vs Autogen Parameter Extraction

### Current Approaches

#### Invoker (Runtime Reflection)

```typescript
// Uses function.toString() and regex parsing
const fnStr = fn
  .toString()
  .replaceAll(/\/\*.*?\*\//g, '') // Remove comments
  .replaceAll(/\/\/.*$/gm, '');
const paramsStr = fnStr
  .slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'))
  .trim();
```

**Advantages**:

- Works on actual runtime functions
- Simple, no dependencies on TypeScript compiler
- Already tested (30+ test cases)
- Handles edge cases: destructuring, defaults, multi-param

**Limitations**:

- Cannot extract TypeScript types (only sees transpiled JS)
- Cannot detect optional (`?`) markers (TypeScript syntax)
- No access to JSDoc comments

#### Autogen (Static AST Analysis)

```typescript
// Uses ts-morph to traverse TypeScript AST
methodDecl.getParameters().map(param => {
  const initializer = param.getInitializer();
  // 50+ lines of switch/case for SyntaxKind
  return {
    name: param.getName(),
    required: !param.isOptional(),
    type: param.getType().getText(),
    value: defaultValue,
  };
});
```

**Advantages**:

- Access to full TypeScript type information
- Detects optional params (`param?: string`)
- Extracts JSDoc comments for documentation
- Can introspect return types

**Limitations**:

- Duplicates parameter name extraction (invoker already does this)
- 90 lines of duplicate code for default value parsing
- Different parsing logic = potential inconsistencies

### The Integration Strategy

**Hybrid Approach**: Use both tools for their strengths

```typescript
// 1. Get runtime function via dynamic import
const serviceFile = await import(serviceFilePath);
const ServiceClass = serviceFile[serviceClassName];
const serviceInstance = new ServiceClass({} as any, {});
const method = serviceInstance[methodName];

// 2. Use INVOKER for parameter names (consistent with runtime)
const paramNames = invoker.extractParamNamesAndDefaults(method);

// 3. Use TS-MORPH for type info (only AST can provide this)
const methodDecl = serviceClassDecl.getMethod(methodName);
const paramTypes = methodDecl.getParameters().map(p => ({
  name: p.getName(),
  type: p.getType().getText(),
  required: !p.isOptional(),
  description: p.getJsDocs()[0]?.getDescription(),
}));

// 4. Merge: param names from invoker + type info from AST
const mergedParams = paramNames.map((param, i) => ({
  ...param,
  ...paramTypes[i],
}));
```

---

## Architecture: Current vs Proposed

### Current Structure (Monolithic)

```
autogen.ts (600 lines)
├── Route discovery (getImportedRouteNames, getRouteHandlerFilePath)
├── Service inference (getServiceNameFromHandlerFile, toPascalCase)
├── Method extraction (getServiceMethodFromHandlerFile - REGEX!)
├── Parameter parsing (90 lines duplicated for HTTP/tRPC)
├── Type introspection (50 lines of SyntaxKind switch/case)
└── Output (console.log only, commented OpenAPI generator)
```

**Problems**:

1. Single Responsibility violation (does everything)
2. Cannot test components in isolation
3. Regex-based extraction is fragile
4. Duplicated logic (HTTP vs tRPC branches are 80% identical)
5. No error handling or validation

### Proposed Structure (Modular)

```
apps/api/src/utils/autogen/
├── index.ts                    # Main orchestrator
├── types.ts                    # Shared interfaces (RouteInfo, ParamMeta, etc.)
├── discovery/
│   ├── route-discovery.ts      # Find route files, imports
│   ├── service-discovery.ts    # Infer service class/method from conventions
│   └── method-discovery.ts     # Extract createRouteHandler calls (NO REGEX)
├── parsers/
│   ├── http-parser.ts          # Parse HTTP route objects
│   ├── trpc-parser.ts          # Parse tRPC router definitions
│   └── param-parser.ts         # Unified parameter extraction (uses invoker!)
├── generators/
│   ├── openapi-generator.ts    # Generate OpenAPI 3.1 spec
│   └── markdown-generator.ts   # Generate API docs (optional)
├── validators/
│   ├── convention-validator.ts # Validate naming conventions
│   └── route-validator.ts      # Validate route structure
└── utils/
    └── ast-helpers.ts          # Shared ts-morph utilities
```

---

## Implementation Plan

### Phase 1: Extract Shared Logic (Quick Wins)

**Goal**: DRY up the codebase without changing architecture

**Tasks**:

1. Create `param-parser.ts` with unified parameter extraction
2. Replace duplicated lines 386-433 and 532-579 with single function call
3. Add invoker integration for parameter names

**Code**:

```typescript
// apps/api/src/utils/autogen/parsers/param-parser.ts
import { invoker } from '@lightproject/common/utils';
import type { MethodDeclaration } from 'ts-morph';
import type { ParamMeta } from '../types';

export async function extractParameterMetadata(
  methodDecl: MethodDeclaration,
  serviceFilePath: string,
  serviceClassName: string,
  methodName: string
): Promise<ParamMeta[]> {
  // 1. Get runtime function for invoker
  const serviceModule = await import(serviceFilePath);
  const ServiceClass = serviceModule[serviceClassName];
  const instance = new ServiceClass({ req: {}, res: {} }, {});
  const runtimeMethod = instance[methodName];

  // 2. Extract param names via invoker (ensures runtime consistency)
  const paramNames = invoker.extractParamNamesAndDefaults(runtimeMethod);

  // 3. Get TypeScript type info via AST
  const astParams = methodDecl.getParameters();

  // 4. Merge runtime names + AST types
  return paramNames.map((param, i) => {
    const astParam = astParams[i];
    if (!astParam) return { name: param.name, type: 'unknown', required: true };

    return {
      name: param.name,
      type: astParam.getType().getText(),
      required: !astParam.isOptional(),
      value: extractDefaultValue(astParam.getInitializer()),
      description: astParam.getJsDocs()[0]?.getDescription(),
    };
  });
}

function extractDefaultValue(initializer: Node | undefined): unknown {
  // Move the 50-line switch/case here (reusable)
  // ... (existing logic from lines 398-429)
}
```

**Benefits**:

- Eliminates 180 lines of duplication
- Ensures invoker and autogen extract parameters identically
- Adds JSDoc description support (bonus feature)

**Estimated Time**: 2-3 hours

---

### Phase 2: Fix tRPC Regex Issue

**Goal**: Replace fragile regex with proper AST traversal

**Current Problem** (lines 131-136):

```typescript
// FRAGILE: Breaks on multi-line, comments, nested structures
const regex = new RegExp(
  `${routePath}:\\s*publicProcedure[\\s\\S]*?\\.((query|mutation))[\\s\\S]*?\\(\\s*(?:\\([^)]*\\)\\s*=>\\s*)?createRouteHandler\\(\\s*(\\w+)[\\s,]*,[\\s'"\`]*(\\w+)[\\s'"\`]*\\)[\\s\\S]*?\\)`,
  'g'
);
```

**Proposed Solution**:

```typescript
// apps/api/src/utils/autogen/discovery/method-discovery.ts
import { SyntaxKind, PropertyAssignment } from 'ts-morph';

export function extractServiceMethodFromTrpcRoute(
  handlerFile: SourceFile,
  propertyKey: string
): { serviceClass: string; methodName: string } | undefined {
  // 1. Find the router call
  const routerCall = handlerFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find(call => call.getExpression().getText() === 'router');

  if (!routerCall) return undefined;

  // 2. Get the router object literal
  const routerObj = routerCall.getArguments()[0];
  if (routerObj?.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return undefined;
  }

  // 3. Find the property matching our route
  const property = routerObj
    .asKind(SyntaxKind.ObjectLiteralExpression)!
    .getProperty(propertyKey);

  if (!property || property.getKind() !== SyntaxKind.PropertyAssignment) {
    return undefined;
  }

  // 4. Traverse: property -> .query() -> createRouteHandler()
  const propAssignment = property as PropertyAssignment;
  const queryCall = propAssignment.getInitializerIfKind(
    SyntaxKind.CallExpression
  );

  if (!queryCall) return undefined;

  // 5. Get createRouteHandler arguments
  const handlerCall = queryCall
    .getArguments()[0]
    ?.asKind(SyntaxKind.CallExpression);

  if (!handlerCall) return undefined;

  const args = handlerCall.getArguments();
  if (args.length < 2) return undefined;

  return {
    serviceClass: args[0]?.getText() ?? '',
    methodName: args[1]?.getText().replaceAll(/['"`]/g, '') ?? '',
  };
}
```

**Benefits**:

- Robust to formatting changes
- Handles comments, multi-line definitions
- Works with nested routers
- Easier to debug (step through AST nodes)

**Estimated Time**: 3-4 hours

---

### Phase 3: Modular Architecture

**Goal**: Split monolithic file into testable modules

**Tasks**:

1. Create directory structure
2. Move discovery logic to `discovery/` modules
3. Move parsing logic to `parsers/` modules
4. Create `index.ts` orchestrator
5. Add unit tests for each module

**Main Orchestrator**:

```typescript
// apps/api/src/utils/autogen/index.ts
import { discoverRoutes } from './discovery/route-discovery';
import { parseHttpRoutes } from './parsers/http-parser';
import { parseTrpcRoutes } from './parsers/trpc-parser';
import { validateRoutes } from './validators/route-validator';
import { generateOpenApiSpec } from './generators/openapi-generator';

export async function build() {
  // 1. Discovery phase
  const httpRouteFiles = await discoverRoutes('http');
  const trpcRouteFiles = await discoverRoutes('trpc');

  // 2. Parsing phase
  const httpRoutes = await parseHttpRoutes(httpRouteFiles);
  const trpcRoutes = await parseTrpcRoutes(trpcRouteFiles);

  // 3. Validation phase
  const allRoutes = [...httpRoutes, ...trpcRoutes];
  const validationErrors = validateRoutes(allRoutes);

  if (validationErrors.length > 0) {
    logger.error('Route validation failed:', validationErrors);
    throw new Error('Invalid routes detected');
  }

  // 4. Generation phase
  await generateOpenApiSpec(allRoutes, './tmp/autogen/openapi.json');

  logger.info(`Generated OpenAPI spec with ${allRoutes.length} routes`);
}
```

**Testing Strategy**:

```typescript
// apps/api/tests/autogen/param-parser.test.ts
describe('extractParameterMetadata', () => {
  it('should extract params matching invoker behavior', async () => {
    // Create test service
    class TestService {
      testMethod(name: string, age?: number) {
        return { name, age };
      }
    }

    // Parse with autogen
    const params = await extractParameterMetadata(
      methodDecl,
      './test-service.ts',
      'TestService',
      'testMethod'
    );

    // Verify matches invoker
    const instance = new TestService({} as any, {});
    const invokerParams = invoker.extractParamNamesAndDefaults(
      instance.testMethod
    );

    expect(params.map(p => p.name)).toEqual(invokerParams.map(p => p.name));
  });
});
```

**Estimated Time**: 8-10 hours

---

### Phase 4: OpenAPI Generation

**Goal**: Output proper OpenAPI 3.1 specification

**Implementation**:

```typescript
// apps/api/src/utils/autogen/generators/openapi-generator.ts
import type { RouteInfo } from '../types';
import type { OpenAPIV3_1 } from 'openapi-types';

export async function generateOpenApiSpec(
  routes: RouteInfo[],
  outputPath: string
): Promise<void> {
  const spec: OpenAPIV3_1.Document = {
    openapi: '3.1.0',
    info: {
      title: 'Pancake API',
      version: '1.0.0',
      description: 'PancakeSwap automation API with HTTP and tRPC endpoints',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Development' }],
    paths: {},
  };

  for (const route of routes) {
    // Convert RouteInfo to OpenAPI path item
    const pathItem = convertRouteToPathItem(route);
    spec.paths[route.path] = pathItem;
  }

  await fs.writeFile(outputPath, JSON.stringify(spec, null, 2));
}

function convertRouteToPathItem(route: RouteInfo): OpenAPIV3_1.PathItemObject {
  return {
    [route.method!]: {
      operationId: `${route.serviceClass}_${route.serviceMethod}`,
      summary: `${route.serviceClass}.${route.serviceMethod}`,
      tags: [route.requestType],
      parameters: route.input?.map(param => ({
        name: param.name,
        in: 'query',
        required: param.required,
        schema: { type: inferOpenApiType(param.type) },
        description: param.description,
      })),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }, // TODO: introspect return type
            },
          },
        },
      },
    },
  };
}
```

**Estimated Time**: 4-5 hours

---

## Migration Strategy

### Step-by-Step Rollout

1. **Week 1**: Phase 1 (extract shared logic)

   - Low risk, immediate benefit
   - Can be merged independently
   - Reduces technical debt

2. **Week 2**: Phase 2 (fix regex)

   - Medium risk (changes tRPC parsing)
   - Add comprehensive tests first
   - Feature flag if needed

3. **Week 3**: Phase 3 (modular architecture)

   - High effort, high value
   - Requires coordinated refactor
   - Enables future features

4. **Week 4**: Phase 4 (OpenAPI generation)
   - New feature, no breaking changes
   - Builds on modular architecture
   - Delivers documentation capability

---

## Success Metrics

- **Code Quality**:

  - Reduce autogen.ts from 600 → ~100 lines (orchestration only)
  - Achieve 90%+ test coverage on new modules
  - Zero ESLint warnings

- **Functionality**:

  - All existing routes introspected correctly
  - Parameter extraction matches invoker 100%
  - Valid OpenAPI 3.1 spec generated

- **Developer Experience**:
  - `pnpm run autogen` completes in <5 seconds
  - Clear error messages for convention violations
  - Easy to add new route types (just implement parser interface)

---

## Risks & Mitigations

| Risk                              | Impact | Mitigation                                    |
| --------------------------------- | ------ | --------------------------------------------- |
| Breaking existing autogen output  | High   | Comprehensive snapshot tests before refactor  |
| Invoker doesn't handle edge cases | Medium | Add failing tests, enhance invoker first      |
| ts-morph performance issues       | Low    | Profile with large codebases, add caching     |
| OpenAPI spec incomplete           | Low    | Start with basic spec, iterate based on needs |

---

## Questions for Discussion

1. **Should we enhance invoker first?**

   - Add TypeScript type extraction capability?
   - Or keep it pure runtime and rely on AST for types?

2. **Testing strategy**:

   - How many real service methods should we test against?
   - Should we generate fixtures or use actual codebase?

3. **Breaking changes**:

   - Can we change RouteInfo interface structure?
   - Or must we maintain backward compatibility?

4. **Output format**:

   - Just OpenAPI, or also Swagger/Postman/etc.?
   - Should we support multiple output formats?

5. **Performance**:
   - Should we cache ts-morph Project between runs?
   - Or rebuild from scratch each time?
