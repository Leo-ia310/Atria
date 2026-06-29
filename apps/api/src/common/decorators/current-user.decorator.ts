import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser, RequestWithAuth } from '@/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    return request.user;
  },
);
