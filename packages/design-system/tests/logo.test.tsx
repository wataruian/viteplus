import { describe, expect, test } from 'vite-plus/test';

import { Logo } from '../src/components/logo';
import { render } from './helpers/render';

describe('Logo', () => {
  test('renders the top and bottom text when useDefault is true', () => {
    const { container, unmount } = render(<Logo textBottom='PROJECT' textTop='LIGHT' />);
    expect(container.textContent).toBe('LIGHTPROJECT');
    unmount();
  });

  test('still renders children alongside the default text block', () => {
    const { container, unmount } = render(
      <Logo textBottom='PROJECT' textTop='LIGHT'>
        <span>extra</span>
      </Logo>,
    );
    expect(container.textContent).toBe('LIGHTPROJECTextra');
    unmount();
  });

  test('renders only children when useDefault is false', () => {
    const { container, unmount } = render(
      <Logo useDefault={false}>
        <span>only child</span>
      </Logo>,
    );
    expect(container.textContent).toBe('only child');
    unmount();
  });
});
