import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  it('renders with correct base classes', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveClass('rounded-xl');
    expect(input).toHaveClass('border');
    expect(input).toHaveClass('border-input');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('supports aria-invalid attribute', () => {
    render(<Input aria-invalid="true" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders disabled state', () => {
    render(<Input disabled data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toBeDisabled();
  });

  it('accepts custom className', () => {
    render(<Input className="my-input" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveClass('my-input');
  });

  it('renders placeholder text', () => {
    render(<Input placeholder="Enter value" />);
    const input = screen.getByPlaceholderText('Enter value');
    expect(input).toBeInTheDocument();
  });
});
