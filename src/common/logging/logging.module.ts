import { Module } from '@nestjs/common';
import { RedactingLoggerService } from './redacting-logger.service';

@Module({
  providers: [RedactingLoggerService],
  exports: [RedactingLoggerService],
})
export class LoggingModule {}
