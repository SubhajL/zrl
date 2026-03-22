import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';

describe('Dialog', () => {
  it('opens dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description text</DialogDescription>
          </DialogHeader>
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText('Dialog body content')).not.toBeInTheDocument();

    await user.click(screen.getByText('Open Dialog'));

    expect(screen.getByText('Dialog body content')).toBeInTheDocument();
  });

  it('closes dialog on close button click', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
          <p>Content here</p>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Content here')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Content here')).not.toBeInTheDocument();
  });

  it('renders title and description', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My Title</DialogTitle>
            <DialogDescription>My Description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByText('Open'));

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Description')).toBeInTheDocument();
  });
});
