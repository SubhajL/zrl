import { NestFactory } from '@nestjs/core';
import { RedactingLoggerService } from './common/logging/redacting-logger.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(RedactingLoggerService));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
