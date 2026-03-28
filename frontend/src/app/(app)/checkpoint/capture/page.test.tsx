import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckpointCapture from './page';
import { loadCheckpointCaptureContext } from '@/lib/checkpoint-capture-data';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () =>
    new URLSearchParams('laneId=lane-db-1&checkpointId=cp-1'),
}));

jest.mock('@/lib/checkpoint-capture-data', () => ({
  loadCheckpointCaptureContext: jest.fn(),
}));

describe('CheckpointCapture', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('renders live checkpoint context from the loader', async () => {
    (loadCheckpointCaptureContext as jest.Mock).mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-001',
        exporterId: 'user-1',
        status: 'EVIDENCE_COLLECTING',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 80,
        coldChainMode: 'LOGGER',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
        batch: null,
        route: null,
        checkpoints: [],
        ruleSnapshot: null,
      },
      checkpoint: {
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 2,
        locationName: 'Laem Chabang Port',
        status: 'PENDING',
        timestamp: null,
        temperature: 11.5,
        gpsLat: null,
        gpsLng: null,
        signatureHash: null,
        signerName: null,
        conditionNotes: null,
      },
    });

    render(<CheckpointCapture />);

    await waitFor(() => {
      expect(screen.getByTestId('lane-info')).toHaveTextContent(
        /LN-2026-001.*Mango.*Japan/,
      );
      expect(screen.getByTestId('checkpoint-name')).toHaveTextContent(
        /Laem Chabang Port/,
      );
    });
  });

  it('submits the checkpoint update to the API', async () => {
    (loadCheckpointCaptureContext as jest.Mock).mockResolvedValue({
      lane: {
        id: 'lane-db-1',
        laneId: 'LN-2026-001',
        exporterId: 'user-1',
        status: 'EVIDENCE_COLLECTING',
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        completenessScore: 80,
        coldChainMode: 'LOGGER',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
        batch: null,
        route: null,
        checkpoints: [],
        ruleSnapshot: null,
      },
      checkpoint: {
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 2,
        locationName: 'Laem Chabang Port',
        status: 'PENDING',
        timestamp: null,
        temperature: 11.5,
        gpsLat: null,
        gpsLng: null,
        signatureHash: null,
        signerName: null,
        conditionNotes: null,
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: { get: () => 'application/json' },
    });

    const user = userEvent.setup();
    render(<CheckpointCapture />);

    await waitFor(() => {
      expect(screen.getByText('1 of 5')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next: photo/i }));
    await user.click(screen.getByRole('button', { name: /next: temperature/i }));
    await user.click(screen.getByRole('button', { name: /next: condition/i }));
    await user.click(screen.getByRole('button', { name: /next: review/i }));
    await user.click(screen.getByRole('button', { name: /submit checkpoint/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zrl/lanes/lane-db-1/checkpoints/cp-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(mockPush).toHaveBeenCalledWith('/lanes/lane-db-1');
    });
  });
});
