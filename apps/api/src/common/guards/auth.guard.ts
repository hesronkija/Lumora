import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@lumora/shared-auth';
import { hasAnyRole } from '@lumora/shared-auth';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.tenantContext) {
      throw new UnauthorizedException('Authentication required');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    if (!hasAnyRole(req.tenantContext.roles, ...requiredRoles)) {
      throw new UnauthorizedException(`Requires one of: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
