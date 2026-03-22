import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './card';

describe('Card', () => {
  it('renders Card with correct base classes', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-2xl');
    expect(card).toHaveClass('border');
    expect(card.className).toContain('shadow');
  });

  it('renders CardHeader, CardTitle, CardContent, CardFooter', () => {
    render(
      <Card>
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Test Title</CardTitle>
        </CardHeader>
        <CardContent data-testid="content">Test Content</CardContent>
        <CardFooter data-testid="footer">Test Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toHaveTextContent('Test Title');
    expect(screen.getByTestId('content')).toHaveTextContent('Test Content');
    expect(screen.getByTestId('footer')).toHaveTextContent('Test Footer');
  });

  it('forwards className to Card', () => {
    render(
      <Card className="my-custom-class" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('my-custom-class');
  });
});
