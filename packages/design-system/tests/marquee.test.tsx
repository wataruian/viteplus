import { describe, expect, test } from 'vite-plus/test';

import { Marquee } from '../src/components/marquee';
import { render } from './render';

describe('Marquee', () => {
  test('renders the children content twice for a seamless loop', () => {
    const { container, unmount } = render(<Marquee>Item</Marquee>);
    const track = container.querySelector('.track');
    expect(track?.textContent).toBe('ItemItem');
    unmount();
  });
});
