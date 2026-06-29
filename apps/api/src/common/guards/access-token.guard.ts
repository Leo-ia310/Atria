import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { JwtUser, RequestWithAuth } from '@/auth/auth.types';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { extractAccessToken } from '@/common/utils/request.utils';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Autenticación requerida.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUser>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      request.user = payload;

      if (request.tenantSlug && request.tenantSlug !== payload.tenantSlug) {
        throw new ForbiddenException('Tenant inválido para esta sesión.');
      }

      return true;
    } catch {
      throw new UnauthorizedException('La sesión no es válida.');
    }
  }
}
