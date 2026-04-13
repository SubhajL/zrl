import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { HashingService } from '../hashing/hashing.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from './audit.types';

describe('AuditInterceptor', () => {
  let reflector: jest.Mocked<Reflector>;
  let hashingService: jest.Mocked<HashingService>;
  let auditService: jest.Mocked<AuditService>;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    hashingService = {
      hashString: jest.fn(),
    } as unknown as jest.Mocked<HashingService>;
    auditService = {
      createEntry: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    interceptor = new AuditInterceptor(reflector, hashingService, auditService);
  });

  it('records an audit entry for annotated handlers', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
    });
    hashingService.hashString.mockResolvedValue(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    auditService.createEntry.mockResolvedValue({
      id: 'audit-1',
      timestamp: new Date('2026-03-21T00:00:00.000Z'),
      actor: 'user-1',
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash:
        '1111111111111111111111111111111111111111111111111111111111111111',
      prevHash:
        '2222222222222222222222222222222222222222222222222222222222222222',
      entryHash:
        '3333333333333333333333333333333333333333333333333333333333333333',
    });

    const context = createExecutionContext({
      params: { id: 'lane-1' },
      user: { id: 'user-1' },
    });
    const next: CallHandler = {
      handle: () => of({ valid: true }),
    };

    interceptor.intercept(context, next).subscribe();
    await flushPromises();

    expect(hashingService.hashString.mock.calls).toEqual([['{"valid":true}']]);
    expect(auditService.createEntry.mock.calls[0]?.[0]).toEqual({
      actor: 'user-1',
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash:
        '1111111111111111111111111111111111111111111111111111111111111111',
    });
  });

  it('passes through when no audit metadata is present', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createExecutionContext({
      params: { id: 'lane-1' },
    });
    const next: CallHandler = {
      handle: jest.fn(() => of({ ok: true })),
    };

    interceptor.intercept(context, next).subscribe();

    expect((next.handle as jest.Mock).mock.calls).toHaveLength(1);
    expect(hashingService.hashString.mock.calls).toHaveLength(0);
    expect(auditService.createEntry.mock.calls).toHaveLength(0);
  });

  it('waits for the audit write before completing the response stream', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
    });
    hashingService.hashString.mockResolvedValue(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );

    let resolveEntry:
      | ((value: Awaited<ReturnType<AuditService['createEntry']>>) => void)
      | undefined;
    auditService.createEntry.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEntry = resolve;
        }),
    );

    const context = createExecutionContext({
      params: { id: 'lane-1' },
      user: { id: 'user-1' },
    });
    const next: CallHandler = {
      handle: () => of({ valid: true }),
    };
    const onComplete = jest.fn();
    const completed = new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        complete: () => {
          onComplete();
          resolve();
        },
      });
    });
    await flushPromises();

    expect(onComplete).not.toHaveBeenCalled();

    resolveEntry?.({
      id: 'audit-1',
      timestamp: new Date('2026-03-21T00:00:00.000Z'),
      actor: 'user-1',
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
      entityId: 'lane-1',
      payloadHash:
        '1111111111111111111111111111111111111111111111111111111111111111',
      prevHash:
        '2222222222222222222222222222222222222222222222222222222222222222',
      entryHash:
        '3333333333333333333333333333333333333333333333333333333333333333',
    });
    await completed;

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('logs audit write failures without failing the response', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    reflector.getAllAndOverride.mockReturnValue({
      action: AuditAction.VERIFY,
      entityType: AuditEntityType.LANE,
    });
    hashingService.hashString.mockResolvedValue(
      '1111111111111111111111111111111111111111111111111111111111111111',
    );
    auditService.createEntry.mockRejectedValue(new Error('audit write failed'));

    const context = createExecutionContext({
      params: { id: 'lane-1' },
      user: { id: 'user-1' },
    });
    const next: CallHandler = {
      handle: () => of({ valid: true }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      valid: true,
    });
    expect(loggerError).toHaveBeenCalledWith(
      'audit write failed',
      expect.any(String),
    );

    loggerError.mockRestore();
  });
});

function createExecutionContext(request: {
  body?: unknown;
  params?: Record<string, string>;
  user?: { id?: string };
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
}
