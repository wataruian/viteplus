import { logger } from '@lightproject/common/logger';
import { type Counter, getMeter } from '@lightproject/common/utils';

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;

let buttonClicksCounter: Counter | undefined = undefined;

const setupCounter = (element: HTMLButtonElement): (() => void) => {
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

    try {
      buttonClicksCounter ??= getMeter().createCounter('button_clicks', {
        description: 'frontend button clicks',
      });
      buttonClicksCounter.add(1);
      logger.info('Pushed button_clicks metric');
    } catch {
      // Skip metric counter if it fails
    }
  };

  element.addEventListener('click', onHandleClick);
  setCounter(INITIAL_COUNT);

  return () => {
    element.removeEventListener('click', onHandleClick);
  };
};

export { setupCounter };
