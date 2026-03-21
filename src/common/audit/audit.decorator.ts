import { SetMetadata } from '@nestjs/common';
import { AUDITED_METADATA } from './audit.constants';
import type { AuditAction, AuditEntityType } from './audit.types';

export function Audited(action: AuditAction, entityType: AuditEntityType) {
  return SetMetadata(AUDITED_METADATA, {
    action,
    entityType,
  });
}
