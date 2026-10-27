interface RaceAbortOptions {
  abortError: (settled: boolean) => Error;
  graceMs?: number;
  onUnsettled?: (graceMs: number) => void;
}

const settleWithin = async <T>(promise: Promise<T>, graceMs: number): Promise<boolean> => {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;
  const settled = await Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise<false>((resolve) => {
      timer = globalThis.setTimeout(() => {
        resolve(false);
      }, graceMs);
    }),
  ]);
  globalThis.clearTimeout(timer);
  return settled;
};

const raceAbort = async <T>(
  promise: Promise<T>,
  signal: AbortSignal,
  { abortError, graceMs = 0, onUnsettled = () => {} }: RaceAbortOptions,
): Promise<T> => {
  promise.catch(() => {});
  const abortedMarker = Symbol('aborted');
  const { promise: aborted, resolve } = Promise.withResolvers<typeof abortedMarker>();
  const onAbort = () => {
    resolve(abortedMarker);
  };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const winner = signal.aborted ? abortedMarker : await Promise.race([promise, aborted]);
    if (winner !== abortedMarker) {
      return winner;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  const settled = await settleWithin(promise, graceMs);
  if (!settled) {
    onUnsettled(graceMs);
  }
  throw abortError(settled);
};

export { raceAbort, settleWithin };
export type { RaceAbortOptions };
