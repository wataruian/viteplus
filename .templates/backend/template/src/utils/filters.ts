const fixFilter = (input: null | Record<string, unknown> | undefined) =>
  input === undefined || input === null || typeof input !== 'object'
    ? {}
    : {
        ...input,
        orderBy: input['orderBy'] ?? undefined,
        where: input['where'] ?? {},
      };

export { fixFilter };
