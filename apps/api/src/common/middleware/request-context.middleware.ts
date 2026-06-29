import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithAuth } from '@/auth/auth.types';
import {
  createRequestId,
  extractTenantSlug,
  getRequestIp,
} from '@/common/utils/request.utils';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: RequestWithAuth, response: Response, next: NextFunction): void {
    request.requestId = createRequestId();
    request.tenantSlug = extractTenantSlug(request);
    request.ipAddress = getRequestIp(request);
    request.userAgent = request.headers['user-agent'] ?? null;

    response.setHeader('x-request-id', request.requestId);
    next();
  }
}
