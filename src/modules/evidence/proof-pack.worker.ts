import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  PROOF_PACK_STORE,
  type ClaimedProofPackJob,
  type ProofPackJobMetrics,
  type ProofPackStore,
} from './proof-pack.types';
import { ProofPackService } from './proof-pack.service';

@Injectable()
export class ProofPackWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProofPackWorkerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private activePollPromise: Promise<void> | null = null;
  private readonly inFlightLeaseRenewals = new Set<Promise<void>>();
  private isPolling = false;
  private isShuttingDown = false;
  private lastAlertSignature: string | null = null;

  constructor(
    @Inject(PROOF_PACK_STORE)
    private readonly store: ProofPackStore,
    private readonly proofPackService: ProofPackService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isWorkerEnabled()) {
      this.logger.warn('Proof-pack worker disabled by configuration.');
      return;
    }

    await this.triggerPollQueue();
    if (this.isShuttingDown) {
      return;
    }

    const intervalMs = this.getPollIntervalMs();
    this.pollTimer = setInterval(() => {
      void this.triggerPollQueue();
    }, intervalMs);
    this.pollTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    const activePollPromise = this.activePollPromise;
    if (activePollPromise !== null) {
      await activePollPromise;
    }

    const inFlightLeaseRenewals = [...this.inFlightLeaseRenewals];
    if (inFlightLeaseRenewals.length > 0) {
      await Promise.allSettled(inFlightLeaseRenewals);
    }
  }

  async getJobMetrics(now = new Date()): Promise<ProofPackJobMetrics> {
    const windowStart = new Date(now.getTime() - this.getMetricsWindowMs());
    const snapshot = await this.store.getJobMetrics(
      windowStart,
      now,
      this.getMaxAttempts(),
    );
    const processed = snapshot.completedInWindow + snapshot.failedInWindow;
    const failureRate =
      processed === 0 ? 0 : snapshot.failedInWindow / processed;
    const alerts = this.buildAlerts(snapshot, failureRate);

    return {
      ...snapshot,
      failureRate,
      windowStart: windowStart.toISOString(),
      generatedAt: now.toISOString(),
      maxAttempts: this.getMaxAttempts(),
      alerts,
    };
  }

  private triggerPollQueue(): Promise<void> {
    if (this.activePollPromise !== null) {
      return this.activePollPromise;
    }

    if (this.isShuttingDown || !this.isWorkerEnabled()) {
      return Promise.resolve();
    }

    const pollPromise = this.pollQueue().finally(() => {
      if (this.activePollPromise === pollPromise) {
        this.activePollPromise = null;
      }
    });
    this.activePollPromise = pollPromise;
    return pollPromise;
  }

  private async pollQueue(): Promise<void> {
    if (this.isPolling || this.isShuttingDown || !this.isWorkerEnabled()) {
      return;
    }

    this.isPolling = true;
    try {
      while (true) {
        const now = new Date();
        const claimedJob = await this.store.leaseNextJob(
          now,
          new Date(now.getTime() + this.getLeaseDurationMs()),
        );
        if (claimedJob === null) {
          break;
        }

        await this.processClaimedJob(claimedJob);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Proof-pack worker poll failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isPolling = false;
      if (!this.isShuttingDown) {
        await this.logAlertState();
      }
    }
  }

  private async processClaimedJob(
    claimedJob: ClaimedProofPackJob,
  ): Promise<void> {
    const initialLeaseExpiresAt = claimedJob.job.leaseExpiresAt;
    if (initialLeaseExpiresAt === null) {
      this.logger.error(
        `Claimed proof-pack job ${claimedJob.job.id} is missing a lease expiration.`,
      );
      return;
    }
    let currentLeaseExpiresAt: Date = initialLeaseExpiresAt;

    const heartbeat = this.startHeartbeat(
      claimedJob,
      () => currentLeaseExpiresAt,
      (leaseExpiresAt) => {
        currentLeaseExpiresAt = leaseExpiresAt;
      },
    );

    try {
      await this.proofPackService.completeLeasedJob(
        claimedJob,
        () => currentLeaseExpiresAt,
      );
    } catch (error: unknown) {
      if (this.isLeaseLostError(error)) {
        this.logger.warn(
          `Skipping stale proof-pack job ${claimedJob.job.id} after lease ownership changed.`,
        );
        return;
      }

      const lastError = this.normalizeErrorMessage(error);

      if (claimedJob.job.attemptCount >= this.getMaxAttempts()) {
        try {
          await this.proofPackService.failLeasedJob(
            claimedJob,
            error,
            currentLeaseExpiresAt,
          );
        } catch (failureError: unknown) {
          if (this.isLeaseLostError(failureError)) {
            this.logger.warn(
              `Skipping terminal failure for stale proof-pack job ${claimedJob.job.id} after lease ownership changed.`,
            );
            return;
          }

          throw failureError;
        }
        this.logger.error(
          `Proof-pack job ${claimedJob.job.id} exhausted retries after ${claimedJob.job.attemptCount} attempts.`,
          error instanceof Error ? error.stack : String(error),
        );
      } else {
        const backoffMs = this.getRetryBackoffMs(claimedJob.job.attemptCount);
        const requeuedJob = await this.store.requeueJob(
          claimedJob.job.id,
          currentLeaseExpiresAt,
          new Date(Date.now() + backoffMs),
          lastError,
        );
        if (requeuedJob === null) {
          this.logger.warn(
            `Skipping stale proof-pack job ${claimedJob.job.id} because its lease changed before requeue.`,
          );
          return;
        }
        this.logger.warn(
          `Requeued proof-pack job ${claimedJob.job.id} after attempt ${claimedJob.job.attemptCount}: ${lastError}`,
        );
      }
    } finally {
      clearInterval(heartbeat);
    }
  }

  private startHeartbeat(
    claimedJob: ClaimedProofPackJob,
    getCurrentLeaseExpiresAt: () => Date,
    setCurrentLeaseExpiresAt: (leaseExpiresAt: Date) => void,
  ): NodeJS.Timeout {
    const interval = setInterval(() => {
      if (this.isShuttingDown) {
        return;
      }

      const leasedAt = new Date();
      const leaseExpiresAt = new Date(
        leasedAt.getTime() + this.getLeaseDurationMs(),
      );
      const renewalPromise = this.store
        .renewJobLease(
          claimedJob.job.id,
          getCurrentLeaseExpiresAt(),
          leasedAt,
          leaseExpiresAt,
        )
        .then((renewed) => {
          if (!renewed) {
            this.logger.warn(
              `Lease heartbeat could not renew proof-pack job ${claimedJob.job.id}.`,
            );
            return;
          }

          setCurrentLeaseExpiresAt(leaseExpiresAt);
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Lease heartbeat failed for proof-pack job ${claimedJob.job.id}.`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      this.inFlightLeaseRenewals.add(renewalPromise);
      void renewalPromise.finally(() => {
        this.inFlightLeaseRenewals.delete(renewalPromise);
      });
    }, this.getHeartbeatIntervalMs());

    interval.unref?.();
    return interval;
  }

  private async logAlertState(): Promise<void> {
    const metrics = await this.getJobMetrics();
    const signature = metrics.alerts.join('|');

    if (metrics.alerts.length === 0) {
      this.lastAlertSignature = null;
      return;
    }

    if (signature !== this.lastAlertSignature) {
      this.logger.warn(
        `Proof-pack worker alerts: ${metrics.alerts.join('; ')}`,
      );
      this.lastAlertSignature = signature;
    }
  }

  private buildAlerts(
    snapshot: Omit<
      ProofPackJobMetrics,
      'failureRate' | 'windowStart' | 'generatedAt' | 'maxAttempts' | 'alerts'
    >,
    failureRate: number,
  ): string[] {
    const alerts: string[] = [];

    if (snapshot.stuckProcessing > 0) {
      alerts.push(`stuck_jobs=${snapshot.stuckProcessing}`);
    }
    if (snapshot.retryExhausted > 0) {
      alerts.push(`retry_exhausted=${snapshot.retryExhausted}`);
    }
    if (failureRate >= this.getFailureRateAlertThreshold()) {
      alerts.push(`failure_rate=${failureRate.toFixed(2)}`);
    }

    return alerts;
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'Proof pack generation failed.';
  }

  private isLeaseLostError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message === 'Proof pack job lease is no longer active.'
    );
  }

  private getRetryBackoffMs(attemptCount: number): number {
    const base = this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_RETRY_BACKOFF_MS'],
      5_000,
    );
    return Math.min(base * 2 ** Math.max(attemptCount - 1, 0), 60_000);
  }

  private getFailureRateAlertThreshold(): number {
    const configured = process.env['PROOF_PACK_JOB_ALERT_FAILURE_RATE'];
    if (configured === undefined) {
      return 0.25;
    }

    const parsed = Number(configured);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.25;
  }

  private getMetricsWindowMs(): number {
    return this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_METRICS_WINDOW_MS'],
      60 * 60_000,
    );
  }

  private getMaxAttempts(): number {
    return this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_MAX_ATTEMPTS'],
      3,
    );
  }

  private getHeartbeatIntervalMs(): number {
    return this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_HEARTBEAT_MS'],
      15_000,
    );
  }

  private getLeaseDurationMs(): number {
    return this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_LEASE_MS'],
      60_000,
    );
  }

  private getPollIntervalMs(): number {
    return this.parsePositiveIntegerEnv(
      process.env['PROOF_PACK_JOB_POLL_INTERVAL_MS'],
      2_000,
    );
  }

  private isWorkerEnabled(): boolean {
    return (process.env['PROOF_PACK_WORKER_ENABLED'] ?? 'true') !== 'false';
  }

  private parsePositiveIntegerEnv(
    value: string | undefined,
    fallback: number,
  ): number {
    if (value === undefined) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
