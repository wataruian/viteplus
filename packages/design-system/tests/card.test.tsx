import { describe, expect, test } from 'vite-plus/test';

import { Card } from '../src/components/card';
import { render } from './render';

describe('Card', () => {
  test('renders children inside a div with variant classes by default', () => {
    const { container, unmount } = render(<Card intent='glass'>Content</Card>);
    const div = container.querySelector('div');
    expect(div?.textContent).toBe('Content');
    expect(div?.className.length).toBeGreaterThan(0);
    unmount();
  });

  test('uses className directly when useDefault is false', () => {
    const { container, unmount } = render(
      <Card className='bare' useDefault={false}>
        Bare
      </Card>,
    );
    expect(container.querySelector('div')?.className).toBe('bare');
    unmount();
  });
});
