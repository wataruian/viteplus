interface Loop {
  stop: () => Promise<void>;
}

const startLoop = (step: () => Promise<number>, onError: (error: unknown) => number): Loop => {
  const { promise: done, resolve: resolveDone } = Promise.withResolvers<undefined>();
  let stopped = false;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;

  const loop = {
    next: (delayMs: number) => {
      if (stopped) {
        resolveDone(undefined);
      } else {
        loop.tick(delayMs);
      }
    },
    tick: (delayMs: number) => {
      timer = globalThis.setTimeout(() => {
        timer = undefined;
        step().then(loop.next, (error: unknown) => {
          loop.next(onError(error));
        });
      }, delayMs);
    },
  };

  loop.tick(0);

  return {
    stop: async () => {
      stopped = true;
      if (timer !== undefined) {
        globalThis.clearTimeout(timer);
        resolveDone(undefined);
      }
      await done;
    },
  };
};

interface IdleBackoff {
  minMs: number;
  maxMs: number;
}

const nextIdleDelay = (previousMs: number | undefined, { maxMs, minMs }: IdleBackoff) =>
  Math.max(minMs, previousMs === undefined ? minMs : Math.min(maxMs, previousMs * 2));

const createIdleBackoff = (backoff: IdleBackoff) => {
  let delayMs: number | undefined = undefined;
  return {
    next: () => {
      delayMs = nextIdleDelay(delayMs, backoff);
      return delayMs;
    },
    reset: () => {
      delayMs = undefined;
    },
  };
};

export { createIdleBackoff, nextIdleDelay, startLoop };
export type { IdleBackoff, Loop };
