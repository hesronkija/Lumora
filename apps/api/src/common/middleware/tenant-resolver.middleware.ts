import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { verifyJwt, type LumoraJwtPayload } from '@lumora/shared-auth';
import { TenantStorage } from '@lumora/shared-tenancy';

declare module 'express' {
  interface Request {
    tenantContext?: LumoraJwtPayload;
  }
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyJwt(token, {
        keycloakUrl: process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
        realm: process.env['KEYCLOAK_REALM'] ?? 'lumora',
        issuer: process.env['JWT_ISSUER'] ?? 'http://localhost:8080/realms/lumora',
      });

      req.tenantContext = payload;

      TenantStorage.run(
        {
          tenantId: payload.tenant_id,
          userId: payload.sub,
          roles: payload.roles,
          scopes: payload.scope_json ? (JSON.parse(payload.scope_json) as Record<string, string[]>) : {},
        },
        () => next(),
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
