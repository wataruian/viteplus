const combineClasses = (...classes: (boolean | null | string | undefined)[]) => {
  const filtered = classes.filter(
    (cls): cls is string => typeof cls === 'string' && cls.trim().length > 0,
  );
  const joined = filtered.join(' ').split(/\s+/);
  const unique = [...new Set(joined)];
  return unique.filter(Boolean).join(' ');
};

export { combineClasses };
