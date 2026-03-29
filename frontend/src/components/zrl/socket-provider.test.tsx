import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { SocketProvider, useSocketContext } from './socket-provider';

jest.mock('@/hooks/use-socket', () => ({
  useSocket: () => ({ socket: { id: 'test-socket' }, connected: true }),
}));

function TestConsumer() {
  const { socket, connected } = useSocketContext();
  return (
    <div>
      <span data-testid="connected">{String(connected)}</span>
      <span data-testid="socket-id">
        {(socket as unknown as { id: string })?.id ?? 'none'}
      </span>
    </div>
  );
}

describe('SocketProvider', () => {
  it('provides socket context to children', () => {
    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );
    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('socket-id').textContent).toBe('test-socket');
  });
});
