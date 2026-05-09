/**
 * Reduces waiting time by two blocks (about 6 seconds)
 */
const reduceWaitingTimeByTwoBlocks = (waitingTime: number): number => {
  const reducedTime = Math.max(waitingTime - 6000, 60_000);
  return reducedTime;
};

/**
 * Sleep for the specified milliseconds
 */
const sleep = async (ms = 0): Promise<void> => {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
};

const eternalSleep = async (): Promise<void> => {
  await new Promise<void>(() => {
    // Intentionally never resolves
  });
};

/**
 * Executes an operation with retry logic
 */
const withRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  const execute = async (attempt: number): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries - 1) {
        throw error;
      }

      await sleep(delay * (attempt + 1)); // Exponential backoff

      return execute(attempt + 1);
    }
  };

  const result = await execute(0);
  return result;
};

export { eternalSleep, reduceWaitingTimeByTwoBlocks, sleep, withRetry };
