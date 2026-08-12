type ModuleExports = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRecordArray = (val: unknown): val is Record<string, unknown>[] =>
  Array.isArray(val) && val.every((item) => isRecord(item));

const isCallable = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';

const isNonNullObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const isModuleExports = (value: unknown): value is ModuleExports =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkDuplicateExports = (
  modules: Record<string, ModuleExports>,
  path: string[] = [],
): void => {
  const allExports = new Map<string, string[]>();

  const deepTraverse = (obj: ModuleExports, currentPath: string[] = []): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = [...currentPath, key];
      const fullPathStr = fullPath.join('.');

      if (isModuleExports(value)) {
        deepTraverse(value, fullPath);
      } else {
        if (!allExports.has(fullPathStr)) {
          allExports.set(fullPathStr, []);
        }
        allExports.get(fullPathStr)?.push(path.join('.'));
      }
    }
  };

  for (const [moduleName, module] of Object.entries(modules)) {
    deepTraverse(module, [moduleName]);
  }

  const duplicates = [...allExports.entries()].filter(([_, sources]) => sources.length > 1);

  if (duplicates.length > 0) {
    const duplicateMessage = duplicates
      .map(
        ([exportName, sources]) =>
          `Export "${exportName}" found in multiple modules: ${sources.join(', ')}`,
      )
      .join('\n');

    throw new Error(`Duplicate exports detected:\n${duplicateMessage}`);
  }
};

export {
  checkDuplicateExports,
  isCallable,
  isModuleExports,
  isNonNullObject,
  isPlainObject,
  isRecord,
  isRecordArray,
};
export type { ModuleExports };
