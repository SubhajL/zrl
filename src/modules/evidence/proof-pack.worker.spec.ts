import { ConflictException } from '@nestjs/common';
import { ProofPackWorkerService } from './proof-pack.worker';
import { ProofPackService } from './proof-pack.service';
import type {
  ClaimedProofPackJob,
  ProofPackJobMetrics,
  ProofPackStore,
} from './proof-pack.types';

function buildClaimedJob(
  overrides: Partial<ClaimedProofPackJob> = {},
): ClaimedProofPackJob {
  return {
    pack: {
      id: 'pack-1',
      laneId: 'lane-1',
      packType: 'REGULATOR',
      version: 1,
      status: 'GENERATING',
      contentHash: null,
      filePath: null,
      errorMessage: null,
      generatedAt: new Date('2026-03-16T10:00:00.000Z'),
      generatedBy: 'user-1',
      recipient: null,
    },
    job: {
      id: 'job-1',
      proofPackId: 'pack-1',
      status: 'PROCESSING',
      payload: {
        laneId: 'LN-2026-001',
        batchId: 'BATCH-001',
        product: 'MANGO',
        market: 'JAPAN',
        variety: 'Nam Dok Mai',
        quantity: 500,
        grade: 'PREMIUM',
        origin: 'Chiang Mai',
        harvestDate: '2026-03-15',
        transportMode: 'AIR',
        carrier: 'Thai Airways',
        completeness: 95,
        status: 'VALIDATED',
        checklistItems: [],
        labResults: null,
        checkpoints: [],
        generatedAt: '2026-03-16T10:00:00.000Z',
        packType: 'REGULATOR',
      },
      attemptCount: 1,
      lastError: null,
      availableAt: new Date('2026-03-16T10:00:00.000Z'),
      leasedAt: new Date('2026-03-16T10:00:05.000Z'),
      leaseExpiresAt: new Date('2026-03-16T10:01:05.000Z'),
      completedAt: null,
      createdAt: new Date('2026-03-16T10:00:00.000Z'),
      updatedAt: new Date('2026-03-16T10:00:05.000Z'),
    },
    ...overrides,
  };
}

describe('ProofPackWorkerService', () => {
  const envSnapshot = { ...process.env };
  let store: {
    leaseNextJob: jest.Mock;
    renewJobLease: jest.Mock;
    requeueJob: jest.Mock;
    getJobMetrics: jest.Mock;
  };
  let proofPackService: {
    completeLeasedJob: jest.Mock;
    failLeasedJob: jest.Mock;
  };
  let service: ProofPackWorkerService;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...envSnapshot };
    process.env['PROOF_PACK_JOB_POLL_INTERVAL_MS'] = '1000';
    process.env['PROOF_PACK_JOB_HEARTBEAT_MS'] = '500';
    process.env['PROOF_PACK_JOB_LEASE_MS'] = '2000';
    process.env['PROOF_PACK_JOB_MAX_ATTEMPTS'] = '3';

    store = {
      leaseNextJob: jest.fn().mockResolvedValue(null),
      renewJobLease: jest.fn().mockResolvedValue(true),
      requeueJob: jest.fn().mockResolvedValue(null),
      getJobMetrics: jest.fn().mockResolvedValue({
        queued: 0,
        processing: 0,
        stuckProcessing: 0,
        retryExhausted: 0,
        completedInWindow: 0,
        failedInWindow: 0,
      } satisfies Omit<
        ProofPackJobMetrics,
        'failureRate' | 'windowStart' | 'generatedAt' | 'maxAttempts' | 'alerts'
      >),
    };
    proofPackService = {
      completeLeasedJob: jest.fn().mockResolvedValue(undefined),
      failLeasedJob: jest.fn().mockResolvedValue(undefined),
    };

    service = new ProofPackWorkerService(
      store as unknown as ProofPackStore,
      proofPackService as unknown as ProofPackService,
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    process.env = envSnapshot;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('leases queued jobs and completes them through the proof-pack service', async () => {
    store.leaseNextJob
      .mockResolvedValueOnce(buildClaimedJob())
      .mockResolvedValueOnce(null);

    await service.onModuleInit();

    expect(store.leaseNextJob).toHaveBeenCalled();
    const completedCalls = proofPackService.completeLeasedJob.mock
      .calls as Array<[ClaimedProofPackJob]>;
    const completedCall = completedCalls[0]?.[0];
    expect(completedCall?.job.id).toBe('job-1');
  });

  it('requeues transient failures with backoff when attempts remain', async () => {
    store.leaseNextJob
      .mockResolvedValueOnce(buildClaimedJob())
      .mockResolvedValueOnce(null);
    proofPackService.completeLeasedJob.mockRejectedValue(
      new Error('temporary rendering issue'),
    );

    await service.onModuleInit();

    expect(store.requeueJob).toHaveBeenCalledWith(
      'job-1',
      new Date('2026-03-16T10:01:05.000Z'),
      expect.any(Date),
      'temporary rendering issue',
    );
    expect(proofPackService.failLeasedJob).not.toHaveBeenCalled();
  });

  it('marks jobs failed after retry exhaustion', async () => {
    store.leaseNextJob
      .mockResolvedValueOnce(
        buildClaimedJob({
          job: {
            ...buildClaimedJob().job,
            attemptCount: 3,
          },
        }),
      )
      .mockResolvedValueOnce(null);
    proofPackService.completeLeasedJob.mockRejectedValue(new Error('fatal'));

    await service.onModuleInit();

    const failedCalls = proofPackService.failLeasedJob.mock.calls as Array<
      [ClaimedProofPackJob, Error]
    >;
    const failedCall = failedCalls[0]?.[0];
    expect(failedCall?.job.id).toBe('job-1');
    expect(failedCall?.job.attemptCount).toBe(3);
    expect(store.requeueJob).not.toHaveBeenCalled();
  });

  it('renews the lease while a job is still processing', async () => {
    let resolveProcessing: (() => void) | null = null;
    store.leaseNextJob
      .mockResolvedValueOnce(buildClaimedJob())
      .mockResolvedValueOnce(null);
    proofPackService.completeLeasedJob.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveProcessing = resolve;
        }),
    );

    const initPromise = service.onModuleInit();
    await Promise.resolve();

    jest.advanceTimersByTime(600);
    await Promise.resolve();
    expect(store.renewJobLease).toHaveBeenCalledWith(
      'job-1',
      expect.any(Date),
      expect.any(Date),
      expect.any(Date),
    );

    resolveProcessing?.();
    await initPromise;
  });

  it('does not requeue or fail when a stale worker loses lease ownership', async () => {
    store.leaseNextJob
      .mockResolvedValueOnce(buildClaimedJob())
      .mockResolvedValueOnce(null);
    proofPackService.completeLeasedJob.mockRejectedValue(
      new ConflictException('Proof pack job lease is no longer active.'),
    );

    await service.onModuleInit();

    expect(store.requeueJob).not.toHaveBeenCalled();
    expect(proofPackService.failLeasedJob).not.toHaveBeenCalled();
  });

  it('awaits in-flight startup polling during shutdown and skips alert metrics', async () => {
    let resolveLeaseNextJob:
      | ((job: ClaimedProofPackJob | null) => void)
      | null = null;
    store.leaseNextJob.mockImplementationOnce(
      () =>
        new Promise<ClaimedProofPackJob | null>((resolve) => {
          resolveLeaseNextJob = resolve;
        }),
    );

    const initPromise = service.onModuleInit();
    await Promise.resolve();

    let shutdownSettled = false;
    const shutdownPromise = Promise.resolve(service.onModuleDestroy()).then(
      () => {
        shutdownSettled = true;
      },
    );

    await Promise.resolve();
    expect(shutdownSettled).toBe(false);

    resolveLeaseNextJob?.(null);
    await initPromise;
    await shutdownPromise;

    expect(store.getJobMetrics).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns job metrics with alerts for stuck jobs and failures', async () => {
    const now = new Date('2026-03-16T10:10:00.000Z');
    store.getJobMetrics.mockResolvedValue({
      queued: 1,
      processing: 2,
      stuckProcessing: 1,
      retryExhausted: 2,
      completedInWindow: 6,
      failedInWindow: 4,
    });

    const metrics = await service.getJobMetrics(now);

    expect(metrics.failureRate).toBe(0.4);
    expect(metrics.alerts).toEqual(
      expect.arrayContaining([
        'stuck_jobs=1',
        'retry_exhausted=2',
        'failure_rate=0.40',
      ]),
    );
  });
});
