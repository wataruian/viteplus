import { createRef } from 'react';
import { describe, expect, test } from 'vite-plus/test';

import { Button } from '../src/components/button';
import { render } from './render';

describe('Button', () => {
  test('renders a <button type="button"> by default', () => {
    const { container, unmount } = render(<Button>Click me</Button>);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.textContent).toBe('Click me');
    unmount();
  });

  test('renders an <a> with the given href instead of a button', () => {
    const { container, unmount } = render(<Button href='/docs'>Docs</Button>);
    expect(container.querySelector('button')).toBeNull();
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/docs');
    expect(link?.textContent).toBe('Docs');
    unmount();
  });

  test('applies variant classes by default and skips them when useDefault is false', () => {
    const { container: withDefault, unmount: unmountDefault } = render(
      <Button intent='danger'>A</Button>,
    );
    expect(withDefault.querySelector('button')?.className.length).toBeGreaterThan(0);
    unmountDefault();

    const { container: withoutDefault, unmount: unmountBare } = render(
      <Button className='my-custom-class' useDefault={false}>
        B
      </Button>,
    );
    expect(withoutDefault.querySelector('button')?.className).toBe('my-custom-class');
    unmountBare();
  });

  test('spreads extra props (e.g. disabled, aria-label) onto the rendered element', () => {
    const { container, unmount } = render(
      <Button props={{ 'aria-label': 'Submit form', disabled: true }}>Submit</Button>,
    );
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Submit form');
    unmount();
  });

  test('forwards the ref to the underlying DOM node', () => {
    const ref = createRef<HTMLButtonElement | HTMLAnchorElement>();
    const { unmount } = render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current).toBeInstanceOf(globalThis.HTMLButtonElement);
    unmount();
  });

  test('forwards an object ref to the anchor element when href is set', () => {
    const ref = createRef<HTMLButtonElement | HTMLAnchorElement>();
    const { unmount } = render(
      <Button href='/docs' ref={ref}>
        Ref link
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(globalThis.HTMLAnchorElement);
    unmount();
  });

  test('forwards a callback ref to both the anchor and button variants', () => {
    const seen: (HTMLAnchorElement | HTMLButtonElement | null)[] = [];
    const refCallback = (node: HTMLAnchorElement | HTMLButtonElement | null) => {
      seen.push(node);
    };

    const { unmount: unmountLink } = render(
      <Button href='/docs' ref={refCallback}>
        Link
      </Button>,
    );
    expect(seen.at(-1)).toBeInstanceOf(globalThis.HTMLAnchorElement);
    unmountLink();

    const { unmount: unmountButton } = render(<Button ref={refCallback}>Btn</Button>);
    expect(seen.at(-1)).toBeInstanceOf(globalThis.HTMLButtonElement);
    unmountButton();
  });
});
