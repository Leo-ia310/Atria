"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const audit_service_1 = require("../audit/audit.service");
const mailer_service_1 = require("../mailer/mailer.service");
const organization_provisioning_service_1 = require("../tenancy/organization-provisioning.service");
const prisma_service_1 = require("../infrastructure/prisma/prisma.service");
const logger_service_1 = require("../infrastructure/logger/logger.service");
const request_utils_1 = require("../common/utils/request.utils");
let AuthService = class AuthService {
    prisma;
    configService;
    jwtService;
    mailerService;
    provisioningService;
    auditService;
    logger;
    constructor(prisma, configService, jwtService, mailerService, provisioningService, auditService, logger) {
        this.prisma = prisma;
        this.configService = configService;
        this.jwtService = jwtService;
        this.mailerService = mailerService;
        this.provisioningService = provisioningService;
        this.auditService = auditService;
        this.logger = logger;
    }
    async register(dto, request, response) {
        const tenantSlug = dto.tenantSlug
            ? dto.tenantSlug.trim().toLowerCase()
            : await this.generateUniqueSlug(dto.companyName);
        if (dto.tenantSlug) {
            const existingOrganization = await this.prisma.organization.findUnique({
                where: { slug: tenantSlug },
            });
            if (existingOrganization) {
                throw new common_1.BadRequestException('El identificador solicitado ya está en uso.');
            }
        }
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (existingUser) {
            throw new common_1.BadRequestException('Ya existe un usuario con ese correo.');
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
            const provisioned = await this.provisioningService.provision(transaction, {
                slug: tenantSlug,
                displayName: dto.companyName,
                legalName: dto.legalName,
                businessType: dto.businessType,
                countryCode: dto.countryCode.toUpperCase(),
                currencyCode: dto.currencyCode.toUpperCase(),
                timezone: dto.timezone,
                primaryBranchName: dto.primaryBranch.name,
            });
            const membership = await transaction.membership.create({
                data: {
                    organizationId: provisioned.organization.id,
                    userId: user.id,
                    roleId: provisioned.ownerRoleId,
                    status: client_1.MembershipStatus.ACTIVE,
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
            const verificationToken = (0, node_crypto_1.randomBytes)(32).toString('hex');
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
        await this.mailerService.sendVerificationEmail(result.user.email, result.organization.displayName, `${this.configService.getOrThrow('APP_URL')}/verificar-correo?tenant=${result.organization.slug}&token=${result.verificationToken}`);
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
    async login(dto, request, response) {
        const user = await this.prisma.user.findFirst({
            where: { email: dto.email.toLowerCase(), deletedAt: null },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales inválidas.');
        }
        const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Credenciales inválidas.');
        }
        const memberships = await this.prisma.membership.findMany({
            where: {
                userId: user.id,
                status: client_1.MembershipStatus.ACTIVE,
                deletedAt: null,
            },
            include: {
                role: true,
                organization: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (memberships.length === 0) {
            throw new common_1.UnauthorizedException('Tu cuenta no tiene ninguna empresa activa.');
        }
        const requestedSlug = dto.tenantSlug?.trim().toLowerCase();
        const membership = requestedSlug
            ? memberships.find((m) => m.organization.slug === requestedSlug)
            : memberships[0];
        if (!membership) {
            throw new common_1.UnauthorizedException('No perteneces a la empresa solicitada.');
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
    async refresh(request, response) {
        const refreshToken = (0, request_utils_1.extractRefreshToken)(request);
        const csrfHeader = request.headers['x-csrf-token'];
        const csrfCookie = request.cookies?.[request_utils_1.cookieNames.csrf];
        if (typeof csrfHeader !== 'string' ||
            !(0, request_utils_1.safeTokenCompare)(csrfHeader, csrfCookie)) {
            throw new common_1.ForbiddenException('CSRF inválido.');
        }
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('No existe un refresh token activo.');
        }
        const payload = await this.jwtService.verifyAsync(refreshToken, {
            secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
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
            throw new common_1.UnauthorizedException('La sesión fue revocada.');
        }
        const isValidToken = await argon2.verify(session.refreshTokenHash, refreshToken);
        if (!isValidToken) {
            throw new common_1.UnauthorizedException('El refresh token no coincide.');
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
    async logout(request, response) {
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
    async forgotPassword(dto) {
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
        const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        await this.prisma.passwordResetToken.create({
            data: {
                organizationId: organization.id,
                userId: membership.user.id,
                tokenHash: this.hashToken(token),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });
        await this.mailerService.sendPasswordResetEmail(membership.user.email, `${this.configService.getOrThrow('APP_URL')}/restablecer?tenant=${organization.slug}&token=${token}`);
        return { requested: true };
    }
    async resetPassword(dto) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug: dto.tenantSlug.trim().toLowerCase() },
        });
        if (!organization) {
            throw new common_1.NotFoundException('No encontramos ese espacio de trabajo.');
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
            throw new common_1.BadRequestException('El enlace de restablecimiento expiró o no es válido.');
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
    async verifyEmail(dto) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug: dto.tenantSlug.trim().toLowerCase() },
        });
        if (!organization) {
            throw new common_1.NotFoundException('No encontramos ese espacio de trabajo.');
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
            throw new common_1.BadRequestException('El enlace de verificación no es válido.');
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
    async me(user) {
        const membership = await this.prisma.membership.findUnique({
            where: { id: user.membershipId },
            include: {
                user: true,
                role: true,
                organization: true,
            },
        });
        if (!membership?.user) {
            throw new common_1.UnauthorizedException('La sesión no es válida.');
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
    async sessions(user) {
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
    async revokeSession(user, sessionId) {
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
    async verifyAccessToken(token) {
        return this.jwtService.verifyAsync(token, {
            secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
        });
    }
    async issueSession(input) {
        const csrfToken = (0, node_crypto_1.randomBytes)(24).toString('hex');
        const sessionPayload = {
            sub: input.userId,
            email: input.email,
            organizationId: input.organizationId,
            tenantSlug: input.tenantSlug,
            membershipId: input.membershipId,
            roleKey: input.roleKey,
            permissions: input.permissions,
            sessionId: (0, node_crypto_1.randomBytes)(16).toString('hex'),
            defaultBranchId: input.defaultBranchId,
        };
        const accessToken = await this.jwtService.signAsync(sessionPayload, {
            secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
            expiresIn: this.configService.getOrThrow('ACCESS_TOKEN_TTL'),
        });
        const refreshToken = await this.jwtService.signAsync(sessionPayload, {
            secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.getOrThrow('REFRESH_TOKEN_TTL'),
        });
        const refreshExpiresMs = (0, request_utils_1.parseDurationToMs)(this.configService.getOrThrow('REFRESH_TOKEN_TTL'));
        const expiresAt = new Date(Date.now() + refreshExpiresMs);
        await this.prisma.deviceSession.create({
            data: {
                id: sessionPayload.sessionId,
                organizationId: input.organizationId,
                userId: input.userId,
                membershipId: input.membershipId,
                refreshTokenHash: await argon2.hash(refreshToken),
                csrfTokenHash: await argon2.hash(csrfToken),
                deviceLabel: (0, request_utils_1.getRequestDeviceLabel)(input.request.userAgent),
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
    applySessionCookies(response, session) {
        const isSecure = this.configService.get('SECURE_COOKIES') ?? false;
        const domain = this.configService.getOrThrow('COOKIE_DOMAIN');
        response.cookie(request_utils_1.cookieNames.access, session.accessToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            domain,
            path: '/',
            maxAge: (0, request_utils_1.parseDurationToMs)(this.configService.getOrThrow('ACCESS_TOKEN_TTL')),
        });
        response.cookie(request_utils_1.cookieNames.refresh, session.refreshToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'strict',
            domain,
            path: '/',
            maxAge: (0, request_utils_1.parseDurationToMs)(this.configService.getOrThrow('REFRESH_TOKEN_TTL')),
        });
        response.cookie(request_utils_1.cookieNames.csrf, session.csrfToken, {
            httpOnly: false,
            secure: isSecure,
            sameSite: 'strict',
            domain,
            path: '/',
            maxAge: (0, request_utils_1.parseDurationToMs)(this.configService.getOrThrow('REFRESH_TOKEN_TTL')),
        });
    }
    clearSessionCookies(response) {
        const domain = this.configService.getOrThrow('COOKIE_DOMAIN');
        response.clearCookie(request_utils_1.cookieNames.access, { path: '/', domain });
        response.clearCookie(request_utils_1.cookieNames.refresh, { path: '/', domain });
        response.clearCookie(request_utils_1.cookieNames.csrf, { path: '/', domain });
    }
    hashToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    async generateUniqueSlug(companyName) {
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
        while (true) {
            const exists = await this.prisma.organization.findUnique({
                where: { slug: candidate },
            });
            if (!exists)
                return candidate;
            n += 1;
            candidate = `${root}-${n}`;
            if (n > 999) {
                candidate = `${root}-${(0, node_crypto_1.randomBytes)(3).toString('hex')}`;
            }
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        jwt_1.JwtService,
        mailer_service_1.MailerService,
        organization_provisioning_service_1.OrganizationProvisioningService,
        audit_service_1.AuditService,
        logger_service_1.StructuredLoggerService])
], AuthService);
//# sourceMappingURL=auth.service.js.map