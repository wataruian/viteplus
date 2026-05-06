# Quick Reference: Invoker + Autogen Integration

## TL;DR

**Problem**: Invoker (runtime) and autogen (static) extract parameters differently → risk of inconsistency

**Solution**: Use invoker for param names, AST for type info, merge results

**Impact**: ~200 lines of code eliminated, guaranteed runtime/documentation consistency

---

## Key Functions

### Invoker (`libs/common/src/utils/invoker.ts`)

```typescript
// Extract parameter names from runtime function
extractParamNamesAndDefaults(fn: Function): { name: string }[]

// Convert input to positional arguments
normalizeArgs(fn: Function, input: unknown): unknown[]

// Execute function with normalized input
invokeWithParsedArgs(fn: Function, input: unknown): ReturnType<typeof fn>
```

### Autogen (`apps/api/src/utils/autogen.ts`)

```typescript
// Main entry point
build(): Promise<void>

// Extract routes from HTTP/tRPC routers
getRoutes(type: 'http' | 'trpc'): Promise<RouteInfo[]>

// Infer service class from filename
getServiceNameFromHandlerFile(path: string): string | undefined

// Extract method name from handler (FRAGILE REGEX!)
getServiceMethodFromHandlerFile(path: string, routePath: string): string | undefined
```

---

## Integration Pattern

```typescript
// 1. Get runtime function
const ServiceClass = (await import(serviceFilePath))[serviceClassName];
const instance = new ServiceClass({} as any, {});
const method = instance[methodName];

// 2. Extract names with invoker (TRUTH SOURCE)
const paramNames = invoker.extractParamNamesAndDefaults(method);

// 3. Get type info from AST
const methodDecl = classDecl.getMethod(methodName);
const astParams = methodDecl.getParameters();

// 4. Merge
const params = paramNames.map((param, i) => ({
  name: param.name, // invoker
  type: astParams[i].getType().getText(), // AST
  required: !astParams[i].isOptional(), // AST
  defaultValue: extractDefault(astParams[i]), // AST
}));
```

---

## Current Issues

| File         | Issue                                    | Lines            | Severity |
| ------------ | ---------------------------------------- | ---------------- | -------- |
| `autogen.ts` | Duplicated param parsing (HTTP/tRPC)     | 386-433, 532-579 | HIGH     |
| `autogen.ts` | Fragile regex for tRPC method extraction | 131-136          | HIGH     |
| `autogen.ts` | No invoker integration                   | N/A              | CRITICAL |
| `invoker.ts` | No default value extraction              | N/A              | MEDIUM   |
| `autogen.ts` | No output type introspection             | 441, 587         | MEDIUM   |
| `autogen.ts` | No tests                                 | N/A              | HIGH     |

---

## Refactoring Checklist

### Phase 1: Quick Wins (2-3 hours)

- [ ] Create `param-parser.ts` with unified extraction logic
- [ ] Integrate invoker for parameter names
- [ ] Replace duplicated lines 386-433 and 532-579
- [ ] Add JSDoc description extraction (bonus)

### Phase 2: Fix Regex (3-4 hours)

- [ ] Implement AST-based tRPC method extraction
- [ ] Replace regex at lines 131-136
- [ ] Add tests for multi-line, comments, nested routers
- [ ] Validate against existing routes

### Phase 3: Modular Architecture (8-10 hours)

- [ ] Create directory structure: `autogen/{discovery,parsers,generators}`
- [ ] Extract route discovery logic
- [ ] Extract parsing logic (http-parser, trpc-parser)
- [ ] Create orchestrator in `index.ts`
- [ ] Add unit tests for each module (target 90%+ coverage)

### Phase 4: OpenAPI Generation (4-5 hours)

- [ ] Implement OpenAPI 3.1 spec generator
- [ ] Convert RouteInfo → OpenAPI paths
- [ ] Add schema generation for params/responses
- [ ] Write output to `tmp/autogen/openapi.json`

---

## Testing Strategy

### Invoker Tests (Add)

```typescript
// Test default value extraction
it('should extract default values', () => {
  const fn = (name = 'default', age = 42) => {};
  const params = extractParamNamesAndDefaults(fn);
  expect(params).toEqual([
    { name: 'name', defaultValue: "'default'" },
    { name: 'age', defaultValue: '42' },
  ]);
});
```

### Autogen Tests (Create)

```typescript
// Test invoker consistency
it('should match invoker parameter names', async () => {
  const routes = await getRoutes('http');
  const testRoute = routes.find(r => r.serviceMethod === 'testMethod');

  // Get runtime function
  const ServiceClass = (await import(testRoute.serviceFilePath))[
    testRoute.serviceClass
  ];
  const instance = new ServiceClass({} as any, {});
  const method = instance[testRoute.serviceMethod];

  // Compare
  const invokerParams = invoker.extractParamNamesAndDefaults(method);
  const autogenParams = testRoute.input;

  expect(autogenParams.map(p => p.name)).toEqual(
    invokerParams.map(p => p.name)
  );
});
```

---

## File Structure (Proposed)

```
apps/api/src/utils/autogen/
├── index.ts                    # Main orchestrator (50 lines)
├── types.ts                    # Shared interfaces
├── discovery/
│   ├── route-discovery.ts      # Find route files
│   ├── service-discovery.ts    # Infer service names
│   └── method-discovery.ts     # Extract handler calls
├── parsers/
│   ├── http-parser.ts          # Parse HTTP routes (80 lines)
│   ├── trpc-parser.ts          # Parse tRPC routes (80 lines)
│   └── param-parser.ts         # HYBRID: invoker + AST (100 lines)
├── generators/
│   └── openapi-generator.ts    # Generate OpenAPI spec (150 lines)
├── validators/
│   └── route-validator.ts      # Validate conventions (50 lines)
└── utils/
    └── ast-helpers.ts          # Shared ts-morph utilities (50 lines)

Total: ~600 lines → distributed across 12 focused modules
```

---

## Decision Points

Before starting refactor, decide:

1. **Invoker enhancements**

   - [ ] Add default value extraction?
   - [ ] Keep pure (runtime only) vs TypeScript-aware?

2. **Autogen output**

   - [ ] OpenAPI only vs multiple formats (Swagger, Postman)?
   - [ ] JSON file vs also Markdown docs?

3. **Validation strictness**

   - [ ] Fail build on convention violations?
   - [ ] Warning only vs blocking errors?

4. **Performance targets**

   - [ ] Acceptable autogen execution time: \_\_\_\_ seconds
   - [ ] Cache ts-morph Project between runs?

5. **Backward compatibility**
   - [ ] Can we change RouteInfo interface?
   - [ ] Or must maintain current structure?

---

## Success Criteria

✅ **Correctness**: Parameter names match invoker 100%
✅ **Coverage**: 90%+ test coverage on new modules
✅ **Performance**: Autogen completes in <5 seconds
✅ **Maintainability**: Each module <150 lines, single responsibility
✅ **Documentation**: Valid OpenAPI 3.1 spec generated
✅ **Developer UX**: Clear error messages for violations

---

## Resources

- **Refactor Plan**: `apps/api/docs/AUTOGEN_REFACTOR_PLAN.md`
- **Deep Analysis**: `apps/api/docs/INVOKER_AUTOGEN_ANALYSIS.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Invoker Tests**: `libs/common/tests/invoker.test.ts`
- **Current Autogen**: `apps/api/src/utils/autogen.ts` (600 lines)
