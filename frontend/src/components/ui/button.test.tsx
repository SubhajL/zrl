import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant classes', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toHaveClass('bg-primary');
  });

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('renders all size variants', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button', { name: 'Small' })).toBeInTheDocument();

    rerender(<Button size="default">Default</Button>);
    expect(screen.getByRole('button', { name: 'Default' })).toBeInTheDocument();

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button', { name: 'Large' })).toBeInTheDocument();

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole('button', { name: 'Icon' })).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('renders as child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Styled</Button>);
    const button = screen.getByRole('button', { name: 'Styled' });
    expect(button).toHaveClass('custom-class');
  });

  it('has accessible focus-visible ring', () => {
    render(<Button>Focus Test</Button>);
    const button = screen.getByRole('button', { name: 'Focus Test' });
    const classes = button.className;
    expect(classes).toContain('focus-visible:ring-2');
    expect(classes).toContain('focus-visible:ring-ring');
  });

  it('disabled button has correct attributes', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });
});
