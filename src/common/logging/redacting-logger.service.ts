import { ConsoleLogger, Injectable } from '@nestjs/common';
import { redactLogValue } from './redaction.utils';

function sanitizeOptionalParams(values: unknown[]): unknown[] {
  return values.map((value) => redactLogValue(value));
}

@Injectable()
export class RedactingLoggerService extends ConsoleLogger {
  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(
      redactLogValue(message),
      ...sanitizeOptionalParams(optionalParams),
    );
  }
}
