import { ConsoleLogger } from '@nestjs/common';
import {
  REDACTED_VALUE,
  redactLogMessage,
  redactLogValue,
} from './redaction.utils';
import { RedactingLoggerService } from './redacting-logger.service';

describe('RedactingLoggerService', () => {
  it('redacts structured pii keys recursively', () => {
    const sanitized = redactLogValue({
      email: 'exporter@example.com',
      phone: '+66 81 234 5678',
      companyName: 'Thai Tropical Exports',
      nested: {
        signerName: 'Somchai Prasert',
        safe: 'kept',
      },
    }) as Record<string, unknown>;

    expect(sanitized).toEqual({
      email: REDACTED_VALUE,
      phone: REDACTED_VALUE,
      companyName: REDACTED_VALUE,
      nested: {
        signerName: REDACTED_VALUE,
        safe: 'kept',
      },
    });
  });

  it('redacts inline email and phone content', () => {
    expect(
      redactLogMessage(
        'Notify somchai@tte.co.th at +66 81 234 5678 about the export',
      ),
    ).toBe('Notify [REDACTED_EMAIL] at [REDACTED_PHONE] about the export');
  });

  it('sanitizes payloads before delegating to ConsoleLogger', () => {
    const service = new RedactingLoggerService();
    const logSpy = jest
      .spyOn(ConsoleLogger.prototype, 'log')
      .mockImplementation(() => undefined);

    service.log({
      email: 'exporter@example.com',
      nested: { signerName: 'Somchai Prasert' },
      safe: 'value',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toEqual({
      email: REDACTED_VALUE,
      nested: { signerName: REDACTED_VALUE },
      safe: 'value',
    });

    logSpy.mockRestore();
  });
});
