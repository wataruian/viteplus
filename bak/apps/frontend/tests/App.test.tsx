import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '../src/app';

const VITE_REACT_REGEX = /Vite \+ React/i;
const TEST_REGEX = /Test/i;

describe('App Component', () => {
  it('renders the main heading', () => {
    const { getByText } = render(<App />);
    expect(getByText(VITE_REACT_REGEX)).toBeInTheDocument();
  });

  it('renders the sample component', () => {
    const { getByText } = render(<App />);
    expect(getByText(TEST_REGEX)).toBeInTheDocument();
  });
});
