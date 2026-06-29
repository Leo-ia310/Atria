import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { JwtUser, RequestWithAuth } from './auth.types';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  RevokeSessionDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Req } from '@nestjs/common';

@ApiTags('Autenticación')
@ApiCookieAuth('atria_access')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Crear tenant, usuario inicial y sesión segura' })
  register(
    @Body() dto: RegisterDto,
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(dto, request, response);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión tenant-aware' })
  login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(dto, request, response);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotar refresh token y renovar sesión' })
  refresh(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refresh(request, response);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh token' })
  logout(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(request, response);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: JwtUser) {
    return this.authService.sessions(user);
  }

  @Post('revoke-session')
  revokeSession(@CurrentUser() user: JwtUser, @Body() dto: RevokeSessionDto) {
    return this.authService.revokeSession(user, dto.sessionId);
  }
}
