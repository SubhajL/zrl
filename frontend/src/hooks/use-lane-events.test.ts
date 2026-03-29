import { renderHook } from '@testing-library/react';
import { useLaneEvents, type LaneEventHandlers } from './use-lane-events';

function createMockSocket(connected = true) {
  return {
    connected,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };
}

describe('useLaneEvents', () => {
  it('subscribes to lane room on mount', () => {
    const socket = createMockSocket();
    renderHook(() => useLaneEvents(socket as never, true, 'lane-1', {}));
    expect(socket.emit).toHaveBeenCalledWith('lane.subscribe', {
      laneId: 'lane-1',
    });
  });

  it('unsubscribes on unmount', () => {
    const socket = createMockSocket();
    const { unmount } = renderHook(() =>
      useLaneEvents(socket as never, true, 'lane-1', {}),
    );
    unmount();
    expect(socket.emit).toHaveBeenCalledWith('lane.unsubscribe', {
      laneId: 'lane-1',
    });
  });

  it('registers event listeners for provided handlers', () => {
    const socket = createMockSocket();
    const handlers: LaneEventHandlers = {
      onStatusChanged: jest.fn(),
      onEvidenceUploaded: jest.fn(),
    };
    renderHook(() => useLaneEvents(socket as never, true, 'lane-1', handlers));
    expect(socket.on).toHaveBeenCalledWith(
      'lane.status.changed',
      handlers.onStatusChanged,
    );
    expect(socket.on).toHaveBeenCalledWith(
      'evidence.uploaded',
      handlers.onEvidenceUploaded,
    );
  });

  it('removes listeners on unmount', () => {
    const socket = createMockSocket();
    const handlers: LaneEventHandlers = { onStatusChanged: jest.fn() };
    const { unmount } = renderHook(() =>
      useLaneEvents(socket as never, true, 'lane-1', handlers),
    );
    unmount();
    expect(socket.off).toHaveBeenCalledWith('lane.status.changed');
  });

  it('does nothing when socket is null', () => {
    const handlers: LaneEventHandlers = { onStatusChanged: jest.fn() };
    renderHook(() => useLaneEvents(null, false, 'lane-1', handlers));
    // No errors thrown, no calls made — the test passing is the assertion
  });

  it('does nothing when laneId is null', () => {
    const socket = createMockSocket();
    renderHook(() => useLaneEvents(socket as never, true, null, {}));
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('does nothing when not connected', () => {
    const socket = createMockSocket(false);
    renderHook(() => useLaneEvents(socket as never, false, 'lane-1', {}));
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('re-subscribes when laneId changes', () => {
    const socket = createMockSocket();
    const { rerender } = renderHook(
      ({ laneId }) => useLaneEvents(socket as never, true, laneId, {}),
      { initialProps: { laneId: 'lane-1' } },
    );
    expect(socket.emit).toHaveBeenCalledWith('lane.subscribe', {
      laneId: 'lane-1',
    });

    rerender({ laneId: 'lane-2' });
    expect(socket.emit).toHaveBeenCalledWith('lane.unsubscribe', {
      laneId: 'lane-1',
    });
    expect(socket.emit).toHaveBeenCalledWith('lane.subscribe', {
      laneId: 'lane-2',
    });
  });
});
