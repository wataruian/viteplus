import { describe, expect, test, vi } from 'vite-plus/test';

import { ErrorBoundary } from '../src/components/error-boundary';
import { render } from './render';

const Bomb = (): never => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  test('renders children when there is no error', () => {
    const { container, unmount } = render(<ErrorBoundary>hello</ErrorBoundary>);
    expect(container.textContent).toContain('hello');
    unmount();
  });

  test('catches a thrown error from a child, renders the fallback UI, and logs via console.error', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain('Component Error');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'An error occurred in the component',
      expect.any(Error),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
    unmount();
  });

  test('forceError renders the error UI even without a real error', () => {
    const { container, unmount } = render(<ErrorBoundary forceError>hello</ErrorBoundary>);
    expect(container.textContent).toContain('Component Error');
    unmount();
  });

  test('uses a custom title and description when provided', () => {
    const { container, unmount } = render(
      <ErrorBoundary description='Something broke' forceError title='Oops'>
        hello
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Oops');
    expect(container.textContent).toContain('Something broke');
    unmount();
  });

  test('renders a custom fallback instead of the default UI when a real error occurs', () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(container.textContent).toBe('custom fallback');

    consoleErrorSpy.mockRestore();
    unmount();
  });

  test('applies the warning intent styling when specified', () => {
    const { container, unmount } = render(<ErrorBoundary forceError intent='warning' />);
    expect(container.querySelector('.i-ph-warning-duotone')).not.toBeNull();
    unmount();
  });

  test('renders no inner content (just the bare Card) when useDefault is false', () => {
    const { container, unmount } = render(
      <ErrorBoundary className='bare' forceError useDefault={false} />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('bare');
    expect(card?.textContent).toBe('');
    unmount();
  });
});
