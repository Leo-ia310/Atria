import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import type { JwtUser, RequestWithAuth } from './auth.types';
import { AuditService } from '@/audit/audit.service';
import { MailerService } from '@/mailer/mailer.service';
import { OrganizationProvisioningService } from '@/tenancy/organization-provisioning.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { StructuredLoggerService } from '@/infrastructure/logger/logger.service';
import {
  cookieNames,
  extractRefreshToken,
  getRequestDeviceLabel,
  parseDurationToMs,
  safeTokenCompare,
} from '@/common/utils/request.utils';

type SessionBundle = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresAt: Date;
  sessionId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly provisioningService: OrganizationProvisioningService,
    private readonly auditService: AuditService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async register(
    dto: RegisterDto,
    request: RequestWithAuth,
    response: Response,
  ) {
    const tenantSlug = dto.tenantSlug
      ? dto.tenantSlug.trim().toLowerCase()
      : await this.generateUniqueSlug(dto.companyName);

    if (dto.tenantSlug) {
      const existingOrganization = await this.prisma.organization.findUnique({
        where: { slug: tenantSlug },
      });
      if (existingOrganization) {
        throw new BadRequestException('El identificador solicitado ya está en uso.');
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Ya existe un usuario con ese correo.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const result = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash,
        },
      });

      const provisioned = await this.provisioningService.provision(
        transaction,
        {
          slug: tenantSlug,
          displayName: dto.companyName,
          legalName: dto.legalName,
          businessType: dto.businessType,
          countryCode: dto.countryCode.toUpperCase(),
          currencyCode: dto.currencyCode.toUpperCase(),
          timezone: dto.timezone,
          primaryBranchName: dto.primaryBranch.name,
        },
      );

      const membership = await transaction.membership.create({
        data: {
          organizationId: provisioned.organization.id,
          userId: user.id,
          roleId: provisioned.ownerRoleId,
          status: MembershipStatus.ACTIVE,
          defaultBranchId: provisioned.primaryBranchId,
        },
        include: {
          role: true,
          organization: true,
        },
      });

      await transaction.employeeProfile.create({
        data: {
          organizationId: provisioned.organization.id,
          membershipId: membership.id,
          branchId: provisioned.primaryBranchId,
          employeeCode: 'EMP-001',
          jobTitle: 'Fundador',
          hireDate: new Date(),
        },
      });

      const verificationToken = randomBytes(32).toString('hex');
      await transaction.emailVerificationToken.create({
        data: {
          organizationId: provisioned.organization.id,
          userId: user.id,
          tokenHash: this.hashToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return {
        organization: membership.organization,
        membership,
        user,
        verificationToken,
      };
    });

    const session = await this.issueSession({
      organizationId: result.organization.id,
      tenantSlug: result.organization.slug,
      userId: result.user.id,
      email: result.user.email,
      membershipId: result.membership.id,
      roleKey: result.membership.role.key,
      permissions: result.membership.role.permissions,
      defaultBranchId: result.membership.defaultBranchId,
      request,
    });

    this.applySessionCookies(response, session);

    await this.mailerService.sendVerificationEmail(
      result.user.email,
      result.organization.displayName,
      `${this.configService.getOrThrow<string>('APP_URL')}/verificar-correo?tenant=${result.organization.slug}&token=${result.verificationToken}`,
    );

    await this.auditService.log({
      organizationId: result.organization.id,
      actorId: result.user.id,
      module: 'auth',
      action: 'register',
      entityType: 'organization',
      entityId: result.organization.id,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      organization: result.organization,
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
      },
    };
  }

  async login(dto: LoginDto, request: RequestWithAuth, response: Response) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: user.id,
        status: MembershipStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        role: true,
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException(
        'Tu cuenta no tiene ninguna empresa activa.',
      );
    }

    // Si el cliente pidió explícitamente un tenant slug, validar acceso;
    // si no, abrir la membresía más reciente.
    const requestedSlug = dto.tenantSlug?.trim().toLowerCase();
    const membership = requestedSlug
      ? memberships.find((m) => m.organization.slug === requestedSlug)
      : memberships[0];

    if (!membership) {
      throw new UnauthorizedException(
        'No perteneces a la empresa solicitada.',
      );
    }

    const organization = membership.organization;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await this.issueSession({
      organizationId: organization.id,
      tenantSlug: organization.slug,
      userId: user.id,
      email: user.email,
      membershipId: membership.id,
      roleKey: membership.role.key,
      permissions: membership.role.permissions,
      defaultBranchId: membership.defaultBranchId,
      request,
    });

    this.applySessionCookies(response, session);

    await this.auditService.log({
      organizationId: organization.id,
      actorId: user.id,
      module: 'auth',
      action: 'login',
      entityType: 'device_session',
      entityId: session.sessionId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: organization.id,
        slug: organization.slug,
        displayName: organization.displayName,
      },
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
      },
    };
  }

  async refresh(request: RequestWithAuth, response: Response) {
    const refreshToken = extractRefreshToken(request);
    const csrfHeader = request.headers['x-atria-csrf'];
    const csrfCookie = request.cookies?.[cookieNames.csrf] as
      | string
      | undefined;

    if (
      typeof csrfHeader !== 'string' ||
      !safeTokenCompare(csrfHeader, csrfCookie)
    ) {
      throw new ForbiddenException('CSRF inválido.');
    }

    if (!refreshToken) {
      throw new UnauthorizedException('No existe un refresh token activo.');
    }

    const payload = await this.jwtService.verifyAsync<JwtUser>(refreshToken, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });

    const session = await this.prisma.deviceSession.findFirst({
      where: {
        id: payload.sessionId,
        organizationId: payload.organizationId,
        userId: payload.sub,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new UnauthorizedException('La sesión fue revocada.');
    }

    const isValidToken = await argon2.verify(
      session.refreshTokenHash,
      refreshToken,
    );
    if (!isValidToken) {
      throw new UnauthorizedException('El refresh token no coincide.');
    }

    await this.prisma.deviceSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const renewedSession = await this.issueSession({
      organizationId: payload.organizationId,
      tenantSlug: payload.tenantSlug,
      userId: payload.sub,
      email: payload.email,
      membershipId: payload.membershipId,
      roleKey: payload.roleKey,
      permissions: payload.permissions,
      defaultBranchId: payload.defaultBranchId,
      request,
    });

    this.applySessionCookies(response, renewedSession);

    return {
      refreshed: true,
      sessionId: renewedSession.sessionId,
      expiresAt: renewedSession.expiresAt,
    };
  }

  async logout(request: RequestWithAuth, response: Response) {
    const sessionId = request.user?.sessionId;

    if (sessionId) {
      await this.prisma.deviceSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    this.clearSessionCookies(response);

    return { loggedOut: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: dto.tenantSlug.trim().toLowerCase() },
    });

    if (!organization) {
      return { requested: true };
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: organization.id,
        user: { email: dto.email.toLowerCase() },
      },
      include: { user: true },
    });

    if (!membership?.user) {
      return { requested: true };
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        organizationId: organization.id,
        userId: membership.user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.mailerService.sendPasswordResetEmail(
      membership.user.email,
      `${this.configService.getOrThrow<string>('APP_URL')}/restablecer?tenant=${organization.slug}&token=${token}`,
    );

    return { requested: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: dto.tenantSlug.trim().toLowerCase() },
    });

    if (!organization) {
      throw new NotFoundException('No encontramos ese espacio de trabajo.');
    }

    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        organizationId: organization.id,
        tokenHash: this.hashToken(dto.token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      throw new BadRequestException(
        'El enlace de restablecimiento expiró o no es válido.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash: await argon2.hash(dto.password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.deviceSession.updateMany({
        where: {
          organizationId: organization.id,
          userId: token.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: dto.tenantSlug.trim().toLowerCase() },
    });

    if (!organization) {
      throw new NotFoundException('No encontramos ese espacio de trabajo.');
    }

    const verification = await this.prisma.emailVerificationToken.findFirst({
      where: {
        organizationId: organization.id,
        tokenHash: this.hashToken(dto.token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new BadRequestException('El enlace de verificación no es válido.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { verified: true };
  }

  async me(user: JwtUser) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: user.membershipId },
      include: {
        user: true,
        role: true,
        organization: true,
      },
    });

    if (!membership?.user) {
      throw new UnauthorizedException('La sesión no es válida.');
    }

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        emailVerifiedAt: membership.user.emailVerifiedAt,
      },
      membership: {
        id: membership.id,
        role: membership.role.name,
        permissions: membership.role.permissions,
        defaultBranchId: membership.defaultBranchId,
      },
      organization: {
        id: membership.organization.id,
        slug: membership.organization.slug,
        displayName: membership.organization.displayName,
        subscriptionPlan: membership.organization.subscriptionPlan,
      },
    };
  }

  async sessions(user: JwtUser) {
    return this.prisma.deviceSession.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.sub,
        revokedAt: null,
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceLabel: true,
        ipAddress: true,
        userAgent: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(user: JwtUser, sessionId: string) {
    await this.prisma.deviceSession.updateMany({
      where: {
        id: sessionId,
        organizationId: user.organizationId,
        userId: user.sub,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revoked: true };
  }

  async verifyAccessToken(token: string): Promise<JwtUser> {
    return this.jwtService.verifyAsync<JwtUser>(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private async issueSession(input: {
    organizationId: string;
    tenantSlug: string;
    userId: string;
    email: string;
    membershipId: string;
    roleKey: string;
    permissions: string[];
    defaultBranchId?: string | null;
    request: RequestWithAuth;
  }): Promise<SessionBundle> {
    const csrfToken = randomBytes(24).toString('hex');
    const sessionPayload: JwtUser = {
      sub: input.userId,
      email: input.email,
      organizationId: input.organizationId,
      tenantSlug: input.tenantSlug,
      membershipId: input.membershipId,
      roleKey: input.roleKey,
      permissions: input.permissions,
      sessionId: randomBytes(16).toString('hex'),
      defaultBranchId: input.defaultBranchId,
    };

    const accessToken = await this.jwtService.signAsync(sessionPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'ACCESS_TOKEN_TTL',
      ) as never,
    });

    const refreshToken = await this.jwtService.signAsync(sessionPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'REFRESH_TOKEN_TTL',
      ) as never,
    });

    const refreshExpiresMs = parseDurationToMs(
      this.configService.getOrThrow<string>('REFRESH_TOKEN_TTL'),
    );
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    await this.prisma.deviceSession.create({
      data: {
        id: sessionPayload.sessionId,
        organizationId: input.organizationId,
        userId: input.userId,
        membershipId: input.membershipId,
        refreshTokenHash: await argon2.hash(refreshToken),
        csrfTokenHash: await argon2.hash(csrfToken),
        deviceLabel: getRequestDeviceLabel(input.request.userAgent),
        ipAddress: input.request.ipAddress,
        userAgent: input.request.userAgent,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      csrfToken,
      expiresAt,
      sessionId: sessionPayload.sessionId,
    };
  }

  private applySessionCookies(
    response: Response,
    session: SessionBundle,
  ): void {
    const isSecure = this.configService.get<boolean>('SECURE_COOKIES') ?? false;
    const domain = this.configService.getOrThrow<string>('COOKIE_DOMAIN');

    response.cookie(cookieNames.access, session.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: parseDurationToMs(
        this.configService.getOrThrow<string>('ACCESS_TOKEN_TTL'),
      ),
    });

    response.cookie(cookieNames.refresh, session.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      domain,
      path: '/',
      maxAge: parseDurationToMs(
        this.configService.getOrThrow<string>('REFRESH_TOKEN_TTL'),
      ),
    });

    response.cookie(cookieNames.csrf, session.csrfToken, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'strict',
      domain,
      path: '/',
      maxAge: parseDurationToMs(
        this.configService.getOrThrow<string>('REFRESH_TOKEN_TTL'),
      ),
    });
  }

  private clearSessionCookies(response: Response): void {
    const domain = this.configService.getOrThrow<string>('COOKIE_DOMAIN');

    response.clearCookie(cookieNames.access, { path: '/', domain });
    response.clearCookie(cookieNames.refresh, { path: '/', domain });
    response.clearCookie(cookieNames.csrf, { path: '/', domain });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const base = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const root = base || 'tenant';
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.organization.findUnique({
        where: { slug: candidate },
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
      if (n > 999) {
        // Fallback: añadimos randomness corta para evitar bucle infinito.
        candidate = `${root}-${randomBytes(3).toString('hex')}`;
      }
    }
  }
}
