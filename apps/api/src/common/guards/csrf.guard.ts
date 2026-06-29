import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithAuth } from '@/auth/auth.types';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { cookieNames, safeTokenCompare } from '@/common/utils/request.utils';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (safeMethods.has(request.method)) {
      return true;
    }

    const hasSessionCookies =
      Boolean(request.cookies?.[cookieNames.access]) ||
      Boolean(request.cookies?.[cookieNames.refresh]);

    if (!hasSessionCookies) {
      return true;
    }

    const cookieToken = request.cookies?.[cookieNames.csrf] as
      | string
      | undefined;
    const headerToken = request.headers['x-atria-csrf'];

    if (
      !cookieToken ||
      typeof headerToken !== 'string' ||
      !safeTokenCompare(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Token CSRF inválido.');
    }

    return true;
  }
}
