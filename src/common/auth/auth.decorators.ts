import { SetMetadata } from '@nestjs/common';

export const AUTH_ROLES_METADATA = 'auth:roles';

export const Roles = (...roles: string[]) =>
  SetMetadata(AUTH_ROLES_METADATA, roles);
