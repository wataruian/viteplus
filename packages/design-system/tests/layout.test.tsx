import { describe, expect, test } from 'vite-plus/test';

import { Container, Section } from '../src/components/layout';
import { render } from './render';

describe('Container', () => {
  test('renders children inside a div with container classes', () => {
    const { container, unmount } = render(<Container>Inner</Container>);
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('Inner');
    expect(div?.className.length).toBeGreaterThan(0);
    unmount();
  });
});

describe('Section', () => {
  test('renders children inside a <section> element', () => {
    const { container, unmount } = render(<Section>Inner</Section>);
    const section = container.querySelector('section');
    expect(section?.textContent).toBe('Inner');
    expect(section?.className.length).toBeGreaterThan(0);
    unmount();
  });
});
