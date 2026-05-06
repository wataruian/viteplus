const TWO_BLOCKS_MS = 6000; // 6 seconds
const MINIMUM_WAIT_TIME_MS = 60_000; // Don't go below 60 seconds

/**
 * Reduces waiting time by two blocks (about 6 seconds)
 */
const reduceWaitingTimeByTwoBlocks = (waitingTime: number): number => {
  const reducedTime = Math.max(
    waitingTime - TWO_BLOCKS_MS,
    MINIMUM_WAIT_TIME_MS
  );
  return reducedTime;
};

/**
 * Sleep for the specified milliseconds
 */
const sleep = async (ms = 0): Promise<void> => {
  return await new Promise(resolve => setTimeout(resolve, ms));
};

const eternalSleep = async (): Promise<void> => {
  return await new Promise(() => {
    // This function will never resolve, effectively putting the process to sleep indefinitely
  });
};

/**
 * Executes an operation with retry logic
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await sleep(delay * (attempt + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
};

export { eternalSleep, reduceWaitingTimeByTwoBlocks, sleep, withRetry };
