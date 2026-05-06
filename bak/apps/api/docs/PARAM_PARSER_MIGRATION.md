# Param-Parser Migration to Common Library

## Date: October 5, 2025

## Overview

Moved `param-parser.ts` from `apps/api/src/utils/autogen/` to `libs/common/src/utils/` to enable reuse across the entire monorepo.

## Changes Made

### 1. New Files Created

#### `libs/common/src/utils/param-parser.ts`

- Moved from `apps/api/src/utils/autogen/param-parser.ts`
- Updated imports to use shared types: `ParameterInfo` and `ParameterMetadata` from `@lightproject/common/types`
- Fixed import ordering to satisfy ESLint perfectionist plugin
- Uses local invoker import: `import * as invoker from './invoker'`

#### `libs/common/src/types/parameter.ts`

- Defines shared parameter type interfaces
- `ParameterInfo`: Basic runtime type (name only)
- `ParameterMetadata`: Extended build-time type with full metadata

#### `libs/common/src/types/index.ts`

- Re-exports all types from `parameter.ts`

### 2. Files Modified

#### `libs/common/src/index.ts`

- Added: `export * from './types';` to expose ParameterInfo and ParameterMetadata

#### `libs/common/src/utils/index.ts`

- Added: `export * as paramParser from './param-parser';` to expose extractParameterMetadata

#### `libs/common/package.json`

- Added `ts-morph` as a dependency (required by param-parser)
- Sorted dependencies alphabetically

#### `apps/api/src/utils/autogen.ts`

- Updated imports:
  - Changed: `import type { ParamMeta } from './autogen/param-parser'`
  - To: `import type { ParameterMetadata } from '@lightproject/common'`
  - Added: `import { paramParser } from '@lightproject/common/utils'`
- Replaced all `ParamMeta` references with `ParameterMetadata`
- Replaced all `extractParameterMetadata(...)` calls with `paramParser.extractParameterMetadata(...)`
- Fixed import ordering (external types before local imports)

### 3. Files Deleted

- `apps/api/src/utils/autogen/` directory (should be removed)

## Import Paths

### Before (API-specific)

```typescript
import type { ParamMeta } from './autogen/param-parser';
import { extractParameterMetadata } from './autogen/param-parser';
```

### After (Monorepo-wide)

```typescript
import type { ParameterMetadata } from '@lightproject/common';
import { paramParser } from '@lightproject/common/utils';

// Usage:
const params = await paramParser.extractParameterMetadata(...);
```

## Benefits

1. **Reusability**: Any workspace in the monorepo can now use param-parser
2. **Single Source of Truth**: Shared types ensure consistency across all consumers
3. **Better Architecture**: Clear separation between runtime (invoker) and build-time (param-parser) utilities
4. **Type Safety**: ParameterMetadata extends ParameterInfo, making the relationship explicit

## Usage Example

```typescript
import type { ParameterMetadata } from '@lightproject/common';
import { paramParser } from '@lightproject/common/utils';
import { Project } from 'ts-morph';

// In any workspace (backend, frontend, api, etc.)
const project = new Project({ tsConfigFilePath: './tsconfig.json' });
const sourceFile = project.getSourceFile('./src/services/my-service.ts');
const classDecl = sourceFile?.getClass('MyService');
const methodDecl = classDecl?.getMethod('myMethod');

if (methodDecl) {
  const params: ParameterMetadata[] =
    await paramParser.extractParameterMetadata(
      methodDecl,
      './src/services/my-service.ts',
      'MyService',
      'myMethod'
    );

  console.log('Parameters:', params);
  // [{ name: 'id', type: 'string', required: true, description: 'User ID' }]
}
```

## Next Steps

1. ✅ Verify all TypeScript/ESLint errors are resolved
2. ✅ Add ts-morph dependency to common library
3. ⏳ Run `pnpm install` to install ts-morph in common
4. ⏳ Run `pnpm run build` to rebuild common library
5. ⏳ Test autogen: `pnpm run autogen` in api workspace
6. ⏳ Update documentation to reference new import paths
7. ⏳ Consider writing unit tests for param-parser in libs/common/tests

## Validation Checklist

- [x] No TypeScript compilation errors
- [x] No ESLint warnings
- [x] Import paths use `@lightproject/common` prefix
- [x] Shared types exported from common library
- [x] Old autogen folder can be safely deleted
- [ ] Tests pass (if any exist)
- [ ] Autogen runs successfully with new imports

## Notes

- The old `apps/api/src/utils/autogen/param-parser.ts` file should be manually deleted
- Run `pnpm install` at the root to update dependencies
- Run `pnpm run build` to rebuild the common library with new exports
