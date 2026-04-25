import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      logger.info({
        method,
        url,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        tenant_id: req.tenantContext?.tenant_id,
        user_id: req.tenantContext?.sub,
      });
    });

    next();
  }
}
