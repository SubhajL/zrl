import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';

@Injectable()
export class CertificationExpiryWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CertificationExpiryWorkerService.name);
  private scanTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly rulesEngineService: RulesEngineService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isWorkerEnabled()) {
      this.logger.warn(
        'Certification expiry worker disabled by configuration.',
      );
      return;
    }

    await this.runScan();
    this.scanTimer = setInterval(() => {
      void this.runScan();
    }, this.getScanIntervalMs());
    this.scanTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.scanTimer !== null) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private async runScan(): Promise<void> {
    if (this.isRunning || !this.isWorkerEnabled()) {
      return;
    }

    this.isRunning = true;
    try {
      const result =
        await this.rulesEngineService.scanCertificationExpirations();
      if (result.notified > 0) {
        this.logger.log(
          `Certification expiry scan processed ${result.processed} artifacts and notified ${result.notified} alerts.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Certification expiry scan failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private isWorkerEnabled(): boolean {
    const enabled =
      process.env['CERTIFICATION_EXPIRY_WORKER_ENABLED'] ?? 'true';
    return enabled !== 'false';
  }

  private getScanIntervalMs(): number {
    const value = process.env['CERTIFICATION_EXPIRY_SCAN_INTERVAL_MS'];
    if (value === undefined) {
      return 24 * 60 * 60_000;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24 * 60 * 60_000;
  }
}
