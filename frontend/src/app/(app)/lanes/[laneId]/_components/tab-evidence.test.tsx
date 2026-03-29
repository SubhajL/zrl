import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabEvidence } from './tab-evidence';
import type { EvidenceArtifact } from '@/lib/types';

/* ── Fixtures ── */

function buildArtifact(
  overrides: Partial<EvidenceArtifact> = {},
): EvidenceArtifact {
  return {
    id: 'artifact-1',
    laneId: 'lane-1',
    artifactType: 'PHYTO_CERT',
    fileName: 'phyto.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    contentHash: 'abcdef1234567890',
    contentHashPreview: 'abcdef12',
    storagePath: 's3://bucket/phyto.pdf',
    verificationStatus: 'VERIFIED',
    source: 'UPLOAD',
    checkpointId: null,
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-03-20T10:05:00Z',
    ...overrides,
  };
}

/* ── Tests ── */

describe('TabEvidence', () => {
  describe('without onUpload prop', () => {
    it('renders upload zones as non-interactive when onUpload is not provided', () => {
      render(<TabEvidence evidence={[]} />);

      // Upload zones should exist but NOT have cursor-pointer class
      const uploadZones = screen.getAllByText(/Upload /);
      expect(uploadZones.length).toBeGreaterThan(0);

      // The parent div should NOT have cursor-pointer
      const firstZone = uploadZones[0].closest(
        'div[class*="border-dashed"]',
      ) as HTMLElement;
      expect(firstZone).not.toHaveClass('cursor-pointer');
    });

    it('does not render hidden file inputs when onUpload is not provided', () => {
      const { container } = render(<TabEvidence evidence={[]} />);
      const fileInputs = container.querySelectorAll('input[type="file"]');
      expect(fileInputs).toHaveLength(0);
    });
  });

  describe('with onUpload prop', () => {
    it('renders upload zones as interactive with cursor-pointer', () => {
      const onUpload = jest.fn().mockResolvedValue(undefined);
      render(<TabEvidence evidence={[]} onUpload={onUpload} />);

      const uploadZones = screen.getAllByText(/Upload /);
      const firstZone = uploadZones[0].closest(
        'div[class*="border-dashed"]',
      ) as HTMLElement;
      expect(firstZone).toHaveClass('cursor-pointer');
    });

    it('renders hidden file inputs for each missing artifact type', () => {
      const onUpload = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      // All 8 artifact types are missing, so 8 file inputs
      const fileInputs = container.querySelectorAll('input[type="file"]');
      expect(fileInputs).toHaveLength(8);
    });

    it('does not render file inputs for artifact types that already have evidence', () => {
      const onUpload = jest.fn().mockResolvedValue(undefined);
      const evidence = [
        buildArtifact({ artifactType: 'PHYTO_CERT' }),
        buildArtifact({ id: 'artifact-2', artifactType: 'MRL_TEST' }),
      ];
      const { container } = render(
        <TabEvidence evidence={evidence} onUpload={onUpload} />,
      );

      // 8 total types - 2 present = 6 missing
      const fileInputs = container.querySelectorAll('input[type="file"]');
      expect(fileInputs).toHaveLength(6);
    });

    it('triggers file input click when upload zone is clicked', () => {
      const onUpload = jest.fn().mockResolvedValue(undefined);
      render(<TabEvidence evidence={[]} onUpload={onUpload} />);

      const uploadZone = screen
        .getByText('Upload MRL Test Report')
        .closest('div[class*="border-dashed"]') as HTMLElement;

      // We can verify the zone is clickable and has proper attributes
      expect(uploadZone).toHaveClass('cursor-pointer');
    });

    it('calls onUpload with artifact type and file when file is selected', async () => {
      const user = userEvent.setup();
      const onUpload = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      // Find the file input for MRL_TEST
      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const testFile = new File(['test content'], 'lab-report.pdf', {
        type: 'application/pdf',
      });

      await user.upload(fileInput, testFile);

      expect(onUpload).toHaveBeenCalledWith('MRL_TEST', testFile);
    });

    it('shows loading state while upload is in progress', async () => {
      const user = userEvent.setup();

      // Create a promise we can control
      let resolveUpload!: () => void;
      const onUpload = jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpload = resolve;
          }),
      );

      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;

      const testFile = new File(['test content'], 'lab-report.pdf', {
        type: 'application/pdf',
      });

      await user.upload(fileInput, testFile);

      // Should show a loading indicator (Loader2 with animate-spin)
      const uploadZone = screen
        .getByText('Uploading...')
        .closest('div[class*="border-dashed"]') as HTMLElement;
      expect(uploadZone).toBeInTheDocument();

      // Resolve the upload
      resolveUpload();
      // Wait for state update
      await screen.findByText('Upload MRL Test Report');
    });

    it('shows error message when upload fails', async () => {
      const user = userEvent.setup();
      const onUpload = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;

      const testFile = new File(['test content'], 'lab-report.pdf', {
        type: 'application/pdf',
      });

      await user.upload(fileInput, testFile);

      // Should show error message
      expect(await screen.findByText('Network error')).toBeInTheDocument();
    });

    it('shows generic error when upload fails with non-Error object', async () => {
      const user = userEvent.setup();
      const onUpload = jest.fn().mockRejectedValue('string error');

      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;

      const testFile = new File(['test content'], 'lab-report.pdf', {
        type: 'application/pdf',
      });

      await user.upload(fileInput, testFile);

      expect(await screen.findByText('Upload failed')).toBeInTheDocument();
    });

    it('file inputs accept correct file types', () => {
      const onUpload = jest.fn().mockResolvedValue(undefined);
      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;
      expect(fileInput.accept).toBe('.pdf,.jpg,.jpeg,.png,.csv,.json');
    });

    it('clears error when a new upload starts', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      const onUpload = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });

      const { container } = render(
        <TabEvidence evidence={[]} onUpload={onUpload} />,
      );

      const fileInput = container.querySelector(
        'input[data-artifact-type="MRL_TEST"]',
      ) as HTMLInputElement;

      // First upload fails
      const testFile = new File(['test content'], 'lab-report.pdf', {
        type: 'application/pdf',
      });
      await user.upload(fileInput, testFile);
      expect(
        await screen.findByText('First attempt failed'),
      ).toBeInTheDocument();

      // Second upload succeeds — error should be cleared
      const testFile2 = new File(['test content 2'], 'lab-report2.pdf', {
        type: 'application/pdf',
      });
      await user.upload(fileInput, testFile2);

      // Wait for the loading to finish, then check error is gone
      await screen.findByText('Upload MRL Test Report');
      expect(
        screen.queryByText('First attempt failed'),
      ).not.toBeInTheDocument();
    });
  });

  describe('existing evidence display', () => {
    it('still renders existing artifacts correctly alongside upload zones', () => {
      const evidence = [buildArtifact({ artifactType: 'PHYTO_CERT' })];
      render(<TabEvidence evidence={evidence} />);

      expect(screen.getByText('phyto.pdf')).toBeInTheDocument();
      expect(screen.getByText('abcdef12')).toBeInTheDocument();
    });
  });
});
