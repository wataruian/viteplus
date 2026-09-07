import { describe, expect, test } from 'vite-plus/test';

import { Badge } from '../src/components/badge';
import { render } from './render';

describe('Badge', () => {
  test('renders children inside a span with variant classes by default', () => {
    const { container, unmount } = render(<Badge intent='success'>New</Badge>);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('New');
    expect(span?.className.length).toBeGreaterThan(0);
    unmount();
  });

  test('uses className directly when useDefault is false', () => {
    const { container, unmount } = render(
      <Badge className='bare' useDefault={false}>
        Bare
      </Badge>,
    );
    expect(container.querySelector('span')?.className).toBe('bare');
    unmount();
  });

  test('spreads extra props onto the span', () => {
    const { container, unmount } = render(<Badge props={{ title: 'three items' }}>3</Badge>);
    expect(container.querySelector('span')?.title).toBe('three items');
    unmount();
  });
});
