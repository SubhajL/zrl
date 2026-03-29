import { renderHook, act, waitFor } from '@testing-library/react';
import { io } from 'socket.io-client';
import { useSocket } from './use-socket';

const mockOn = jest.fn();
const mockDisconnect = jest.fn();
const mockSocket: {
  on: jest.Mock;
  disconnect: jest.Mock;
  auth: Record<string, unknown>;
} = { on: mockOn, disconnect: mockDisconnect, auth: {} };

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

global.fetch = jest.fn();

const mockIo = io as jest.MockedFunction<typeof io>;

describe('useSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'test-token' }),
    });
  });

  it('fetches token and creates socket connection', async () => {
    renderHook(() => useSocket());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/session/ws-token', {
        method: 'POST',
      });
    });

    expect(mockIo).toHaveBeenCalledWith(
      expect.stringContaining('/ws'),
      expect.objectContaining({
        auth: { token: 'test-token' },
        transports: ['websocket'],
      }),
    );
  });

  it('returns connected false initially', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.connected).toBe(false);
  });

  it('updates connected state on connect event', async () => {
    let connectHandler: (() => void) | undefined;
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler;
    });

    const { result } = renderHook(() => useSocket());

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    act(() => {
      connectHandler?.();
    });
    expect(result.current.connected).toBe(true);
  });

  it('disconnects socket on unmount', async () => {
    const { unmount } = renderHook(() => useSocket());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('refreshes token on connect_error for reconnection', async () => {
    let errorHandler: (() => void) | undefined;
    mockOn.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect_error') errorHandler = handler;
    });

    renderHook(() => useSocket());

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    // Simulate token refresh returning a new token
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'refreshed-token' }),
    });

    act(() => {
      errorHandler?.();
    });

    await waitFor(() => {
      // Second call is the refresh
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(mockSocket.auth).toEqual({ token: 'refreshed-token' });
  });

  it('does not connect when token fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    renderHook(() => useSocket());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(mockIo).not.toHaveBeenCalled();
  });
});
