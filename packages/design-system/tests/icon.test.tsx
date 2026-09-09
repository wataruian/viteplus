import { describe, expect, test } from 'vite-plus/test';

import { Icon } from '../src/components/icon';
import { render } from './helpers/render';

describe('Icon', () => {
  test('renders a span with the icon name class appended', () => {
    const { container, unmount } = render(<Icon name='i-ph-star-fill' />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('i-ph-star-fill');
    unmount();
  });

  test('includes size variant classes by default', () => {
    const { container, unmount } = render(<Icon name='i-ph-star-fill' size='lg' />);
    expect(container.querySelector('span')?.className.length).toBeGreaterThan(
      'i-ph-star-fill'.length,
    );
    unmount();
  });

  test('uses className directly (plus the icon name) when useDefault is false', () => {
    const { container, unmount } = render(
      <Icon className='bare' name='i-ph-star-fill' useDefault={false} />,
    );
    expect(container.querySelector('span')?.className).toBe('bare i-ph-star-fill');
    unmount();
  });
});
