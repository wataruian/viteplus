type ModuleExports = Record<string, unknown>;

// Function to check for duplicate exports
const checkDuplicateExports = (
  modules: Record<string, ModuleExports>,
  path: string[] = []
): void => {
  const allExports = new Map<string, string[]>();

  const deepTraverse = (
    obj: ModuleExports,
    currentPath: string[] = []
  ): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = [...currentPath, key];
      const fullPathStr = fullPath.join('.');

      // If it's an object (namespace), recurse
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        deepTraverse(value as ModuleExports, fullPath);
      } else {
        // Track export
        if (!allExports.has(fullPathStr)) {
          allExports.set(fullPathStr, []);
        }
        allExports.get(fullPathStr)?.push(path.join('.'));
      }
    }
  };

  // Collect all exports
  for (const [moduleName, module] of Object.entries(modules)) {
    deepTraverse(module, [moduleName]);
  }

  // Check for duplicates
  const duplicates = [...allExports.entries()].filter(
    ([_, sources]) => sources.length > 1
  );

  if (duplicates.length > 0) {
    const duplicateMessage = duplicates
      .map(
        ([exportName, sources]) =>
          `Export "${exportName}" found in multiple modules: ${sources.join(
            ', '
          )}`
      )
      .join('\n');

    throw new Error(`Duplicate exports detected:\n${duplicateMessage}`);
  }
};

export type { ModuleExports };
export { checkDuplicateExports };
