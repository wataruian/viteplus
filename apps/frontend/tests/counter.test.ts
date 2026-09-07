import { describe, expect, test } from 'vite-plus/test';

import { setupCounter } from '../src/counter';

describe('setupCounter', () => {
  test('sets the initial text content to "Count is 0"', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);
    expect(button.textContent).toBe('Count is 0');
    cleanup();
  });

  test('increments the count and updates the text content on each click', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);

    button.click();
    expect(button.textContent).toBe('Count is 1');

    button.click();
    button.click();
    expect(button.textContent).toBe('Count is 3');

    cleanup();
  });

  test('the returned cleanup function stops further clicks from incrementing the count', () => {
    const button = globalThis.document.createElement('button');
    const cleanup = setupCounter(button);

    button.click();
    expect(button.textContent).toBe('Count is 1');

    cleanup();
    button.click();
    expect(button.textContent).toBe('Count is 1');
  });

  test('each call to setupCounter tracks its own independent count', () => {
    const buttonA = globalThis.document.createElement('button');
    const buttonB = globalThis.document.createElement('button');
    const cleanupA = setupCounter(buttonA);
    const cleanupB = setupCounter(buttonB);

    buttonA.click();
    buttonA.click();
    buttonB.click();

    expect(buttonA.textContent).toBe('Count is 2');
    expect(buttonB.textContent).toBe('Count is 1');

    cleanupA();
    cleanupB();
  });
});
