import { describe, expect, test } from 'vite-plus/test';

import { Input } from '../src/components/input';
import { render } from './helpers/render';

describe('Input', () => {
  test('renders an <input> with variant classes by default', () => {
    const { container, unmount } = render(<Input state='error' />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.className.length).toBeGreaterThan(0);
    unmount();
  });

  test('uses className directly when useDefault is false', () => {
    const { container, unmount } = render(<Input className='bare' useDefault={false} />);
    expect(container.querySelector('input')?.className).toBe('bare');
    unmount();
  });

  test('spreads extra props (placeholder, value, onChange) onto the input', () => {
    const { container, unmount } = render(
      <Input props={{ placeholder: 'Enter name', readOnly: true, value: 'Bob' }} />,
    );
    const input = container.querySelector('input');
    expect(input?.placeholder).toBe('Enter name');
    expect(input?.readOnly).toBe(true);
    expect(input?.value).toBe('Bob');
    unmount();
  });
});
