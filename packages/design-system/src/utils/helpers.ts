const classPrefix = 'ds';

const combineClasses = (...classes: (boolean | null | string | undefined)[]) => {
  const filtered = classes.filter(
    (cls): cls is string => typeof cls === 'string' && cls.trim().length > 0,
  );
  const joined = filtered.join(' ').split(/\s+/u);
  const unique = [...new Set(joined)];
  return unique.filter(Boolean).join(' ');
};

const extract = (obj: unknown, result: string[]) => {
  if (typeof obj === 'string') {
    result.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      extract(item, result);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      extract(value, result);
    }
  }
};

const getStyles = (...styles: unknown[]): string => {
  const result: string[] = [];

  for (const style of styles) {
    extract(style, result);
  }

  const uniqueClasses = [...new Set(result.join(' ').split(/\s+/u))];
  return uniqueClasses.filter(Boolean).join(' ');
};

export { classPrefix, combineClasses, extract, getStyles };
