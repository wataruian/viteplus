import { logger } from '@lightproject/common/logger';

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;

export const setupCounter = (element: HTMLButtonElement): (() => void) => {
  let counter = INITIAL_COUNT;
  const setCounter = (count: number): void => {
    counter = count;
    element.innerHTML = `Count is ${counter}`;
  };

  const onHandleClick = (): void => {
    const nextCount = counter + INCREMENT_STEP;
    logger.info('Counter incremented', {
      nextCount,
      previousCount: counter,
    });
    setCounter(nextCount);
  };

  element.addEventListener('click', onHandleClick);
  setCounter(INITIAL_COUNT);

  return () => {
    element.removeEventListener('click', onHandleClick);
  };
};
