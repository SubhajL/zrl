import { Logger } from '@nestjs/common';
import { CertificationExpiryWorkerService } from './certification-expiry.worker';

describe('CertificationExpiryWorkerService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs one scan on bootstrap and avoids overlapping runs', async () => {
    jest.useFakeTimers();
    let resolveSecondScan: (() => void) | null = null;
    const scanCertificationExpirations = jest
      .fn()
      .mockResolvedValueOnce({ processed: 0, notified: 0, skipped: 0 })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            resolveSecondScan = () =>
              resolve({ processed: 0, notified: 0, skipped: 0 });
          }),
      )
      .mockResolvedValue({ processed: 0, notified: 0, skipped: 0 });
    const service = new CertificationExpiryWorkerService({
      scanCertificationExpirations,
    } as never);

    await service.onModuleInit();
    expect(scanCertificationExpirations).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(24 * 60 * 60_000);
    await Promise.resolve();
    expect(scanCertificationExpirations).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(24 * 60 * 60_000);
    await Promise.resolve();
    expect(scanCertificationExpirations).toHaveBeenCalledTimes(2);

    resolveSecondScan?.();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(24 * 60 * 60_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(scanCertificationExpirations).toHaveBeenCalledTimes(3);

    service.onModuleDestroy();
  });

  it('logs scan failures and keeps the worker alive', async () => {
    jest.useFakeTimers();
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const scanCertificationExpirations = jest
      .fn()
      .mockRejectedValue(new Error('scan failed'));
    const service = new CertificationExpiryWorkerService({
      scanCertificationExpirations,
    } as never);

    await service.onModuleInit();
    expect(loggerErrorSpy).toHaveBeenCalled();

    loggerErrorSpy.mockRestore();
    service.onModuleDestroy();
  });
});
