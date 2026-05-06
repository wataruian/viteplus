# 🚀 Next Steps After Param-Parser Migration

## Current Status

✅ **Migration Complete** - All files validated, zero errors, ready to build

---

## Immediate Actions (Required)

### 1. Install Dependencies

```bash
# From monorepo root
pnpm install
```

**Why**: Installs `ts-morph@26.0.0` in `libs/common`

**Expected output**:

```
Packages: +1
+ ts-morph 26.0.0
```

---

### 2. Rebuild Common Library

```bash
# From monorepo root
pnpm run build

# OR build just common library
pnpm --filter @lightproject/common run build
```

**Why**: Generates dist files with new param-parser exports

**Expected output**:

```
@lightproject/common:build: Build success
```

**Verify**: Check that these files exist:

- `libs/common/dist/utils/param-parser.mjs`
- `libs/common/dist/utils/param-parser.d.mts`
- `libs/common/dist/types/parameter.mjs`
- `libs/common/dist/types/parameter.d.mts`

---

### 3. Test Autogen Integration

```bash
# From api workspace
pnpm --filter @lightproject/api run autogen
```

**Why**: Validates that autogen.ts correctly imports and uses paramParser from common

**Expected output**:

```
[HTTP Routes]
  GET /api/ -> DefaultService.root
  ...

[tRPC Routes]
  /trpc/default.root -> DefaultService.root
  ...

✓ Route introspection complete
```

**If errors occur**: Check that:

1. Common library built successfully
2. ts-morph is installed in common
3. Import paths in autogen.ts are correct

---

## Short-term Actions (Recommended)

### 4. Validate from Another Workspace

Test that param-parser works from backend or frontend:

```typescript
// In apps/backend/src/test-param-parser.ts
import type { ParameterMetadata } from '@lightproject/common';
import { paramParser } from '@lightproject/common/utils';
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: './tsconfig.json' });
// ... test extraction
```

**Why**: Proves true monorepo reusability

---

### 5. Write Unit Tests

Create `libs/common/tests/utils/param-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { paramParser } from '../../src/utils';
import { Project } from 'ts-morph';

describe('paramParser.extractParameterMetadata', () => {
  it('should extract parameter names via invoker', async () => {
    // Test implementation
  });

  it('should extract TypeScript types via AST', async () => {
    // Test implementation
  });

  it('should extract JSDoc descriptions', async () => {
    // Test implementation
  });

  it('should extract default values', async () => {
    // Test implementation
  });

  it('should fallback gracefully if runtime import fails', async () => {
    // Test implementation
  });
});
```

**Run tests**:

```bash
pnpm --filter @lightproject/common test
```

---

### 6. Update Phase Documentation

Mark param-parser migration as complete in existing docs:

**Update `apps/api/docs/PHASE_1_COMPLETE.md`**:

- Add section: "Post-Phase 1: Migration to Common Library"
- Note new import paths
- Link to PARAM_PARSER_MIGRATION.md

---

## Medium-term Actions (Next Phases)

### 7. Phase 2: Fix tRPC Regex (3-4 hours)

**Goal**: Replace fragile regex-based tRPC method extraction with AST traversal

**Current issue** (autogen.ts line ~340):

```typescript
const methodMatch = handlerCode.match(
  /createRouteHandler\(\s*(\w+),\s*['"](\w+)['"]\s*\)/
);
```

**Problem**: Breaks on:

- Multi-line expressions
- Comments between arguments
- Complex formatting

**Solution**: Use ts-morph to traverse CallExpression nodes

**Reference**: See `apps/api/docs/AUTOGEN_REFACTOR_PLAN.md` Phase 2

---

### 8. Phase 3: Modular Architecture (8-10 hours)

**Goal**: Split autogen into focused modules

**Proposed structure**:

```
apps/api/src/utils/autogen/
├── index.ts                    # Main orchestrator
├── discovery/
│   ├── route-discovery.ts      # Find HTTP routes
│   └── trpc-discovery.ts       # Find tRPC procedures
├── parsers/
│   ├── service-parser.ts       # Extract service/method info
│   └── param-parser.ts         # Already in common! Just import
├── generators/
│   ├── openapi-generator.ts    # Generate OpenAPI spec
│   └── route-info-generator.ts # Generate RouteInfo[]
└── types.ts                    # RouteInfo, etc.
```

**Reference**: See `apps/api/docs/AUTOGEN_REFACTOR_PLAN.md` Phase 3

---

### 9. Phase 4: OpenAPI Generation (4-5 hours)

**Goal**: Generate OpenAPI/Swagger spec from RouteInfo[]

**Output**: `tmp/openapi.json` with full API documentation

**Features**:

- Auto-generate parameter schemas from ParameterMetadata
- Infer response schemas (future: use param-parser for return types)
- Support for both HTTP and tRPC routes

**Reference**: See `apps/api/docs/AUTOGEN_REFACTOR_PLAN.md` Phase 4

---

## Long-term Actions (Future Enhancements)

### 10. Extend Param-Parser Features

- [ ] Extract return type metadata (for response documentation)
- [ ] Support for generic type parameters
- [ ] Parse additional JSDoc tags (@returns, @throws)
- [ ] Validation schema generation (Zod, Joi)

### 11. Additional Monorepo Utilities

Move more utilities to common:

- [ ] `route-handler.ts` (currently api-specific)
- [ ] Service base classes
- [ ] Validation helpers
- [ ] Error handling utilities

### 12. Documentation Generation

- [ ] Generate Markdown API docs from RouteInfo[]
- [ ] Generate interactive API playground
- [ ] Auto-update README with available endpoints

---

## Troubleshooting

### Issue: "Cannot find module '@lightproject/common'"

**Solution**: Run `pnpm install` and rebuild common library

### Issue: "Module has no exported member 'paramParser'"

**Solution**:

1. Check `libs/common/src/utils/index.ts` has export
2. Rebuild common: `pnpm --filter @lightproject/common run build`

### Issue: "Property 'extractParameterMetadata' does not exist"

**Solution**: Check import is `paramParser.extractParameterMetadata` not `paramParser.paramParser.extractParameterMetadata`

### Issue: Autogen fails with import error

**Solution**:

1. Ensure ts-morph is installed in common
2. Check service files are importable
3. Verify tsconfig.json paths are correct

---

## Success Criteria

You'll know everything works when:

- ✅ `pnpm install` completes without errors
- ✅ `pnpm run build` succeeds for common library
- ✅ `pnpm run autogen` outputs route information
- ✅ No TypeScript errors in any workspace
- ✅ Can import paramParser from any workspace

---

## Commands Quick Reference

```bash
# Install dependencies
pnpm install

# Build everything
pnpm run build

# Build just common
pnpm --filter @lightproject/common run build

# Run autogen
pnpm --filter @lightproject/api run autogen

# Test common library
pnpm --filter @lightproject/common test

# Lint everything
pnpm run lint

# Type check everything
pnpm run typecheck

# Start development
pnpm run dev
```

---

## Questions?

**Documentation**:

- Migration guide: `apps/api/docs/PARAM_PARSER_MIGRATION.md`
- Usage examples: `apps/api/docs/PARAM_PARSER_USAGE.md`
- Validation report: `apps/api/docs/VALIDATION_REPORT.md`
- Refactoring plan: `apps/api/docs/AUTOGEN_REFACTOR_PLAN.md`

**Copilot Instructions**: `.github/copilot-instructions.md`

---

## What's Next? 🎯

**Recommended order**:

1. ✅ Complete immediate actions (install, build, test)
2. 📝 Write unit tests for param-parser
3. 🔧 Start Phase 2 (fix tRPC regex)
4. 🏗️ Proceed to Phase 3 (modular architecture)
5. 📄 Implement Phase 4 (OpenAPI generation)

**Time estimate**:

- Immediate actions: 10 minutes
- Short-term actions: 2-3 hours
- All phases: 15-19 hours total

Good luck! 🚀
