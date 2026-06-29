import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestWithAuth } from '@/auth/auth.types';
import { AuditService } from '@/audit/audit.service';

const mutatingMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    return next.handle().pipe(
      tap(() => {
        if (!mutatingMethods.has(request.method)) {
          return;
        }

        const route = request.route as { path?: string } | undefined;

        void this.auditService.log({
          organizationId: request.user?.organizationId ?? null,
          actorId: request.user?.sub ?? null,
          module: request.url.split('/')[3] ?? 'unknown',
          action: request.method,
          entityType: route?.path ?? request.url,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          metadata: {
            params: request.params,
            query: request.query,
          },
        });
      }),
    );
  }
}
