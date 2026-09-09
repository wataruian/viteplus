import { describe, expect, test } from 'vite-plus/test';

import { Marquee } from '../src/components/marquee';
import { render } from './helpers/render';

describe('Marquee', () => {
  test('renders the children content twice for a seamless loop', () => {
    const { container, unmount } = render(<Marquee>Item</Marquee>);
    const track = container.querySelector('.track');
    expect(track?.textContent).toBe('ItemItem');
    unmount();
  });

  test('uses className directly and skips the track look class when useDefault is false', () => {
    const { container, unmount } = render(
      <Marquee className='bare' useDefault={false}>
        Item
      </Marquee>,
    );
    expect(container.querySelector('div')?.className).toBe('bare');
    expect(container.querySelector('.track')?.className).toBe('track');
    unmount();
  });
});
