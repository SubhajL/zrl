import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ROLES_METADATA } from './auth.decorators';
import { AuthService } from './auth.service';
import type {
  AuthPrincipalRequest,
  AuthRole,
  AuthSessionUser,
} from './auth.types';

function normalizeRole(role: string): AuthRole {
  return role.trim().toUpperCase() as AuthRole;
}

function getBearerToken(
  headerValue: string | string[] | undefined,
): string | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (value === undefined || value.length === 0) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match === null ? null : match[1];
}

function getForwardedIp(
  headerValue: string | string[] | undefined,
): string | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (value === undefined) {
    return null;
  }

  const [firstIp] = value.split(',', 1);
  const normalized = firstIp?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    const token = getBearerToken(request.headers['authorization']);

    if (token === null) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const verified = await this.authService.verifyAccessToken(token);
    request.auth = {
      kind: 'jwt',
      user: verified.user,
      token: verified.claims,
    };
    request.user = verified.user;
    return true;
  }
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    const headerValue = request.headers['x-api-key'];
    const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (apiKey === undefined || apiKey.length === 0) {
      throw new UnauthorizedException('Missing API key.');
    }

    const validation = await this.authService.validateApiKey({
      apiKey,
      ipAddress: this.resolveIpAddress(request),
    });

    if (
      validation.state !== 'VALID' ||
      validation.user === undefined ||
      validation.apiKey === undefined
    ) {
      throw new UnauthorizedException(`API key rejected: ${validation.state}.`);
    }

    request.auth = {
      kind: 'api-key',
      user: validation.user,
      apiKey: validation.apiKey,
    };
    request.user = validation.user;
    return true;
  }

  private resolveIpAddress(request: AuthPrincipalRequest): string {
    const ip = request.ip?.trim() ?? '';
    if (ip.length > 0) {
      return ip;
    }

    return getForwardedIp(request.headers['x-forwarded-for']) ?? '';
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      AUTH_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    const user = this.requireUser(request);
    const allowedRoles = requiredRoles.map(normalizeRole);

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role.');
    }

    return true;
  }

  private requireUser(request: AuthPrincipalRequest): AuthSessionUser {
    if (request.user !== undefined) {
      return request.user;
    }

    if (request.auth !== undefined) {
      return request.auth.user;
    }

    throw new UnauthorizedException('Authentication required.');
  }
}

@Injectable()
export class LaneOwnerGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    const user = this.requireUser(request);
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      return true;
    }

    const laneId = request.params?.['laneId'] ?? request.params?.['id'];
    if (laneId === undefined) {
      throw new ForbiddenException('Lane context required.');
    }

    const ownerId = await this.authService.resolveLaneOwnerId(laneId);

    if (ownerId !== user.id) {
      throw new ForbiddenException('Lane ownership required.');
    }

    return true;
  }

  private requireUser(request: AuthPrincipalRequest): AuthSessionUser {
    if (request.user !== undefined) {
      return request.user;
    }

    if (request.auth !== undefined) {
      return request.auth.user;
    }

    throw new UnauthorizedException('Authentication required.');
  }
}

@Injectable()
export class PartnerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    if (request.auth?.kind !== 'api-key') {
      throw new ForbiddenException('Partner API key required.');
    }

    if (request.auth.user.role !== 'PARTNER') {
      throw new ForbiddenException('Partner role required.');
    }

    const laneId = request.params?.['laneId'] ?? request.params?.['id'];
    if (laneId === undefined) {
      throw new ForbiddenException('Lane context required.');
    }

    const scopes = request.auth.apiKey.scopes.map((scope) =>
      scope.trim().toLowerCase(),
    );
    const allowed =
      scopes.includes('*') ||
      scopes.includes('lane:*') ||
      scopes.includes('lane:read') ||
      scopes.includes(`lane:${laneId.toLowerCase()}`);

    if (!allowed) {
      throw new ForbiddenException('Partner scope required.');
    }

    return true;
  }
}

@Injectable()
export class AuditorReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthPrincipalRequest>();
    const user = request.user ?? request.auth?.user;

    if (user === undefined) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (user.role !== 'AUDITOR') {
      return true;
    }

    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    throw new ForbiddenException('Auditor role is read-only.');
  }
}
