import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { concatMap } from 'rxjs';
import { HashingService } from '../hashing/hashing.service';
import { AUDITED_METADATA } from './audit.constants';
import { AuditService } from './audit.service';
import type { AuditedMetadata } from './audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const metadata = this.reflector.getAllAndOverride<AuditedMetadata>(
      AUDITED_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (metadata === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      body?: unknown;
      params?: Record<string, string>;
      user?: { id?: string };
    }>();

    return next.handle().pipe(
      concatMap(async (responseBody: unknown): Promise<unknown> => {
        try {
          await this.recordAuditEntry(request, responseBody, metadata);
        } catch (error: unknown) {
          const resolved =
            error instanceof Error ? error : new Error(String(error));
          this.logger.error(resolved.message, resolved.stack);
        }

        return responseBody;
      }),
    );
  }

  private async recordAuditEntry(
    request: {
      body?: unknown;
      params?: Record<string, string>;
      user?: { id?: string };
    },
    responseBody: unknown,
    metadata: AuditedMetadata,
  ): Promise<void> {
    const entityId =
      request.params?.['id'] ??
      request.params?.['laneId'] ??
      request.params?.['entityId'];

    if (entityId === undefined) {
      return;
    }

    const actor =
      typeof request.user?.id === 'string' && request.user.id.length > 0
        ? request.user.id
        : 'system';
    const payload =
      JSON.stringify(responseBody ?? request.body ?? null) ?? 'null';
    const payloadHash = await this.hashingService.hashString(payload);

    await this.auditService.createEntry({
      actor,
      action: metadata.action,
      entityType: metadata.entityType,
      entityId,
      payloadHash,
    });
  }
}
