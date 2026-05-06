import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import Sample from '../../src/components/sample';

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((message: string) => {
    if (message.includes('ReactDOMTestUtils.act')) {
      return;
    }
    console.error(message);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Sample Component', () => {
  it('renders input fields and button', () => {
    render(<Sample />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('displays success message', async () => {
    render(<Sample />);
    fireEvent.click(screen.getByText('Test'));
    const successMessage = await Promise.resolve(screen.findByText('Success!'));
    expect(successMessage).toBeInTheDocument();
  });
});
