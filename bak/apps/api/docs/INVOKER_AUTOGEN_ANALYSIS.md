# Invoker + Autogen: Deep Dive Analysis

## The Core Problem

**You have TWO systems extracting the SAME information (function parameters) using DIFFERENT methods:**

### System 1: Invoker (Runtime)

- **Location**: `libs/common/src/utils/invoker.ts`
- **Method**: Function `.toString()` + regex parsing
- **Used By**: `route-handler.ts` at runtime for every API request
- **Purpose**: Convert HTTP/tRPC input → function arguments

### System 2: Autogen (Static)

- **Location**: `apps/api/src/utils/autogen.ts`
- **Method**: TypeScript AST traversal via ts-morph
- **Used By**: Build-time code generation (manual: `pnpm run autogen`)
- **Purpose**: Generate API documentation from route definitions

**The Gap**: They analyze the same functions but can produce different results!

---

## How Invoker Works

### The Magic: Runtime Reflection

```typescript
// Given a function
const myFunc = (name: string, age?: number) => ({ name, age });

// Invoker does this:
const fnStr = myFunc.toString();
// => "(name, age) => ({ name, age })"

// Extract params from the string
const paramsStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
// => "name, age"

// Parse into array
const params = paramsStr.split(',').map(p => p.trim());
// => ["name", "age"]
```

### Normalization: The Input Transformer

**Key Insight**: HTTP/tRPC can send data in 3 formats:

1. **Primitive**: `'hello'` (single value)
2. **Array**: `['hello', 42]` (positional)
3. **Object**: `{name: 'hello', age: 42}` (named)

Invoker converts ALL formats → positional array for function call:

```typescript
// Service method
async greet(name: string, age?: number) {
  return `Hello ${name}, age ${age}`;
}

// HTTP request body: {"name": "Alice", "age": 30}
invoker.normalizeArgs(greet, {name: "Alice", age: 30})
// => ["Alice", 30]

// tRPC input: ["Bob", 25]
invoker.normalizeArgs(greet, ["Bob", 25])
// => ["Bob", 25]

// Edge case: single primitive
invoker.normalizeArgs(greet, "Charlie")
// => ["Charlie", undefined]
```

### Special Case: Destructured Parameters

**This is the tricky part** that invoker handles elegantly:

```typescript
// Destructured function
const withOptions = ({ foo, bar }: { foo: string; bar?: number }) => {
  return { foo, bar };
};

// Invoker detects destructuring
const params = extractParamNamesAndDefaults(withOptions);
// => [{ name: "{ foo, bar }" }]  // Note: SINGLE param, not two!

// Normalization: pass entire object as-is
normalizeArgs(withOptions, { foo: 'test', bar: 42 });
// => [{ foo: 'test', bar: 42 }]  // Wrapped in array, but object intact
```

**Why this matters**: Routes can send `{foo: 'x', bar: 5}` and invoker knows to:

1. Detect function expects destructured object
2. NOT split into `['x', 5]`
3. Pass entire object as single argument

---

## How Autogen Works

### The Magic: Static Analysis

```typescript
// Parse TypeScript source code
const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const sourceFile = project.getSourceFile('services/default.ts');
const classDecl = sourceFile.getClass('DefaultService');
const methodDecl = classDecl.getMethod('greet');

// Get parameters via AST
const params = methodDecl.getParameters();

params.map(param => ({
  name: param.getName(), // "name"
  type: param.getType().getText(), // "string"
  required: !param.isOptional(), // true
  defaultValue: param.getInitializer()?.getText(), // undefined
}));
```

### Default Value Extraction

**The 50-line switch/case** (lines 398-429 in autogen.ts):

```typescript
const initializer = param.getInitializer();
const kind = initializer.getKind();

switch (kind) {
  case SyntaxKind.StringLiteral:
    return initializer.getText().slice(1, -1); // Remove quotes
  case SyntaxKind.NumericLiteral:
    return Number(initializer.getText());
  case SyntaxKind.TrueKeyword:
    return true;
  case SyntaxKind.FalseKeyword:
    return false;
  case SyntaxKind.ObjectLiteralExpression:
    return JSON.parse(initializer.getText().replaceAll("'", '"'));
  case SyntaxKind.ArrayLiteralExpression:
    return JSON.parse(initializer.getText().replaceAll("'", '"'));
  default:
    return initializer.getText(); // Fallback: raw string
}
```

**Problem**: Invoker doesn't extract default values (only names). But autogen does this in 90 lines of duplicated code (HTTP + tRPC).

---

## The Consistency Problem

### Example: Destructured Parameters

```typescript
// Service method
class UserService extends BaseService {
  updateUser({
    id,
    name,
    email,
  }: {
    id: string;
    name?: string;
    email?: string;
  }) {
    // ...
  }
}
```

**Invoker sees** (at runtime):

```typescript
extractParamNamesAndDefaults(instance.updateUser);
// => [{ name: "{ id, name, email }" }]
```

**Autogen sees** (via AST):

```typescript
methodDecl.getParameters();
// => [
//   {
//     name: "{ id, name, email }",  // MIGHT see "id" if parsing destructuring
//     type: "{ id: string; name?: string; email?: string }"
//   }
// ]
```

**Potential inconsistency**:

- Invoker: Single param with destructured name
- Autogen: Could extract as 3 separate params (if parsing destructuring)

**Result**: Documentation says "3 parameters" but runtime expects 1 object!

---

## The Solution: Hybrid Approach

### Use Each Tool for Its Strength

| Task                      | Best Tool         | Reason                                        |
| ------------------------- | ----------------- | --------------------------------------------- |
| Extract param **names**   | **Invoker**       | Guaranteed to match runtime behavior          |
| Extract param **types**   | **Autogen (AST)** | Only AST has TypeScript type info             |
| Extract **defaults**      | **Autogen (AST)** | Invoker can't see defaults in transpiled code |
| Detect **optional** (`?`) | **Autogen (AST)** | TypeScript syntax, lost at runtime            |
| Extract **JSDoc**         | **Autogen (AST)** | Comments don't exist at runtime               |

### Implementation Pattern

```typescript
// Step 1: Dynamic import to get runtime function
const serviceModule = await import('./services/user.ts');
const ServiceClass = serviceModule.UserService;
const instance = new ServiceClass({} as any, {});
const runtimeMethod = instance.updateUser;

// Step 2: Use INVOKER for parameter names (truth source)
const paramNames = invoker.extractParamNamesAndDefaults(runtimeMethod);
// => [{ name: "{ id, name, email }" }]

// Step 3: Use AST for type info
const methodDecl = classDecl.getMethod('updateUser');
const astParams = methodDecl.getParameters();
// => [Parameter node with type info]

// Step 4: MERGE both sources
const mergedParams = paramNames.map((invokerParam, index) => {
  const astParam = astParams[index];

  return {
    name: invokerParam.name, // From INVOKER
    type: astParam.getType().getText(), // From AST
    required: !astParam.isOptional(), // From AST
    defaultValue: extractDefaultValue(astParam), // From AST
    description: astParam.getJsDocs()[0]?.getDescription(), // From AST
  };
});
```

**Result**: Best of both worlds!

- **Name extraction**: Guaranteed to match runtime (no inconsistency)
- **Type info**: Full TypeScript type system
- **Documentation**: JSDoc comments included

---

## Invoker Improvements Needed

### Current Limitations

1. **No default value extraction**

   ```typescript
   const fn = (name: string = 'default') => name;
   extractParamNamesAndDefaults(fn);
   // => [{ name: "name" }]  // Missing defaultValue!
   ```

2. **No type information**

   ```typescript
   // Can't tell if param is string, number, object
   // All we see is the name
   ```

3. **Destructuring edge cases**

   ```typescript
   // Multi-line destructuring with defaults
   const fn = ({ foo = 'default', bar, baz = 42 }: Options) => {};

   // Current parsing might struggle with this
   ```

### Proposed Enhancements

#### Option A: Keep Invoker Pure (Recommended)

- Don't try to extract types (that's AST's job)
- Focus on robust name extraction
- Add better destructuring support
- Add default value extraction from string

```typescript
// Enhanced version
interface ParsedParam {
  name: string;
  defaultValue?: string; // Raw string from source
}

extractParamNamesAndDefaults(fn): ParsedParam[]
```

#### Option B: TypeScript-Aware Invoker

- Parse TypeScript annotations from source
- Requires source file access (not just runtime function)
- More complex, duplicates autogen's job

**Recommendation**: Option A - keep invoker focused on runtime, use AST for static info.

---

## Test Coverage Analysis

### Invoker Tests (Current)

**Patterns Covered**:

- ✅ No params: `() => {}`
- ✅ Single primitive: `(name: string) => {}`
- ✅ Multiple primitives: `(name: string, age: number) => {}`
- ✅ Array param: `(items: string[]) => {}`
- ✅ Object param: `(options: Options) => {}`
- ✅ Destructured: `({ foo, bar }: Options) => {}`
- ✅ Mixed: `(id: string, options?: Options) => {}`

**Patterns NOT Covered**:

- ❌ Defaults: `(name = 'default') => {}`
- ❌ Rest params: `(...args: any[]) => {}`
- ❌ Complex destructuring: `({ foo: { bar } }) => {}`
- ❌ Renamed destructuring: `({ foo: renamedFoo }) => {}`

### Autogen Tests (Current)

**Coverage**: ZERO! No tests exist.

**Needed Tests**:

```typescript
describe('autogen parameter extraction', () => {
  it('should match invoker for simple params', async () => {
    // Test that autogen + invoker produce same param names
  });

  it('should extract TypeScript types', async () => {
    // Verify type info is correct
  });

  it('should handle destructured params', async () => {
    // Critical edge case
  });

  it('should extract default values', async () => {
    // Test the 50-line switch/case
  });
});
```

---

## Performance Considerations

### Invoker Performance

- **Cost**: String manipulation + regex
- **Speed**: Microseconds per function
- **Called**: On EVERY request (hot path)
- **Optimization**: Already optimal (simple operations)

### Autogen Performance

- **Cost**: Full TypeScript project compilation
- **Speed**: Seconds to minutes (depends on project size)
- **Called**: Manually via `pnpm run autogen`
- **Optimization Opportunities**:
  1. Cache ts-morph Project between runs
  2. Only re-parse changed files (watch mode)
  3. Parallel processing of route files

### Hybrid Approach Cost

- **Additional**: Dynamic import of service modules
- **Impact**: +50-100ms per service (one-time at build)
- **Worth it**: Yes - eliminates inconsistency risk

---

## Migration Risks

### High Risk: Breaking Changes

1. **Parameter name mismatch**

   - Current autogen might produce different names than invoker
   - Fix: Use invoker as source of truth
   - Impact: Documentation regenerated with correct names

2. **Destructuring interpretation**
   - AST might expand `({ foo, bar })` → 2 params
   - Invoker treats as 1 param
   - Fix: Always use invoker's interpretation
   - Impact: OpenAPI spec changes (fewer parameters)

### Medium Risk: New Dependencies

1. **Dynamic imports in autogen**

   - Currently uses only static analysis
   - Adding runtime imports requires service files to be importable
   - Fix: Ensure services have no side effects on import
   - Impact: Might catch initialization bugs early (good!)

2. **Invoker default value extraction**
   - If we enhance invoker, might change its API
   - Fix: Version the enhancement, add feature flag
   - Impact: Route-handler.ts needs update too

### Low Risk: Performance

1. **ts-morph startup cost**
   - Already slow, dynamic imports won't make it worse
   - Fix: Cache and reuse Project instance
   - Impact: Minimal (autogen is build-time only)

---

## Recommendations

### Immediate Actions (This Week)

1. **Add invoker enhancement for defaults**

   ```typescript
   // New function in invoker.ts
   const extractParamNamesAndDefaults = fn => {
     const fnStr = fn.toString();
     // ... existing logic ...

     // NEW: Extract default value from string
     const match = param.match(/(\w+)\s*=\s*(.+?)(?:,|$)/);
     if (match) {
       return {
         name: match[1],
         defaultValue: match[2].trim(),
       };
     }
     return { name: param };
   };
   ```

2. **Add autogen tests**

   - Create test service with known parameters
   - Verify autogen extracts them correctly
   - Compare with invoker output

3. **Document the gap**
   - ✅ Already done in copilot-instructions.md
   - Add inline comments in autogen.ts explaining the issue

### Short Term (Next 2 Weeks)

4. **Implement hybrid parameter extraction**

   - Create `param-parser.ts` as shown in refactor plan
   - Use invoker for names, AST for types
   - Test against all existing services

5. **Fix tRPC regex issue**
   - Replace with AST traversal
   - Add tests for edge cases

### Medium Term (Next Month)

6. **Full modular refactor**

   - Split autogen into discovery/parsing/generation
   - Each module independently testable
   - Enable OpenAPI generation

7. **CI/CD integration**
   - Run autogen on PR builds
   - Fail if route conventions violated
   - Auto-update API docs on merge

---

## Open Questions

1. **Should invoker extract default values?**

   - Pro: Single source of truth for parameter info
   - Con: String parsing is fragile, might not work for complex defaults
   - Decision: ?

2. **Should we support non-function service methods?**

   - Current: All methods are functions
   - Future: Might have getters/setters
   - Decision: ?

3. **How to handle async/generator functions?**

   - Invoker: `async (name) => {}` vs `(name) => {}`
   - Do we care about the async keyword?
   - Decision: ?

4. **Should autogen validate parameter consistency?**

   - Check if invoker + AST produce same param count
   - Warn if mismatch detected
   - Decision: ?

5. **Performance target for autogen?**
   - Current: ~5 seconds for small codebase
   - Target: <3 seconds? <10 seconds?
   - Decision: ?
