import { describe, expect, test } from 'vite-plus/test';

import { Typography } from '../src/components/typography';
import { render } from './render';

describe('Typography', () => {
  test('renders a <p> by default', () => {
    const { container, unmount } = render(<Typography>Body text</Typography>);
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toBe('Body text');
    unmount();
  });

  test('renders the element given by the "as" prop', () => {
    const { container, unmount } = render(
      <Typography as='h1' type='headline'>
        Headline
      </Typography>,
    );
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toBe('Headline');
    expect(heading?.className.length).toBeGreaterThan(0);
    unmount();
  });

  test('uses className directly when useDefault is false', () => {
    const { container, unmount } = render(
      <Typography className='bare' useDefault={false}>
        Bare
      </Typography>,
    );
    expect(container.querySelector('p')?.className).toBe('bare');
    unmount();
  });
});
