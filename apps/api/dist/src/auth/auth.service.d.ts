import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import type { JwtUser, RequestWithAuth } from './auth.types';
import { AuditService } from "../audit/audit.service";
import { MailerService } from "../mailer/mailer.service";
import { OrganizationProvisioningService } from "../tenancy/organization-provisioning.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { StructuredLoggerService } from "../infrastructure/logger/logger.service";
export declare class AuthService {
    private readonly prisma;
    private readonly configService;
    private readonly jwtService;
    private readonly mailerService;
    private readonly provisioningService;
    private readonly auditService;
    private readonly logger;
    constructor(prisma: PrismaService, configService: ConfigService, jwtService: JwtService, mailerService: MailerService, provisioningService: OrganizationProvisioningService, auditService: AuditService, logger: StructuredLoggerService);
    register(dto: RegisterDto, request: RequestWithAuth, response: Response): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        };
        organization: {
            id: string;
            slug: string;
            displayName: string;
            legalName: string;
            businessType: import("@prisma/client").$Enums.BusinessType;
            countryCode: string;
            currencyCode: string;
            timezone: string;
            subscriptionPlan: import("@prisma/client").$Enums.PlanCode;
            onboardingCompletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
        };
        session: {
            id: string;
            expiresAt: Date;
            csrfToken: string;
        };
    }>;
    login(dto: LoginDto, request: RequestWithAuth, response: Response): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        };
        organization: {
            id: string;
            slug: string;
            displayName: string;
        };
        session: {
            id: string;
            expiresAt: Date;
            csrfToken: string;
        };
    }>;
    refresh(request: RequestWithAuth, response: Response): Promise<{
        refreshed: boolean;
        sessionId: string;
        expiresAt: Date;
    }>;
    logout(request: RequestWithAuth, response: Response): Promise<{
        loggedOut: boolean;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        requested: boolean;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        reset: boolean;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        verified: boolean;
    }>;
    me(user: JwtUser): Promise<{
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            emailVerifiedAt: Date | null;
        };
        membership: {
            id: string;
            role: string;
            permissions: string[];
            defaultBranchId: string | null;
        };
        organization: {
            id: string;
            slug: string;
            displayName: string;
            subscriptionPlan: import("@prisma/client").$Enums.PlanCode;
        };
    }>;
    sessions(user: JwtUser): Promise<{
        id: string;
        ipAddress: string | null;
        userAgent: string | null;
        deviceLabel: string;
        lastSeenAt: Date;
        expiresAt: Date;
    }[]>;
    revokeSession(user: JwtUser, sessionId: string): Promise<{
        revoked: boolean;
    }>;
    verifyAccessToken(token: string): Promise<JwtUser>;
    private issueSession;
    private applySessionCookies;
    private clearSessionCookies;
    private hashToken;
    private generateUniqueSlug;
}
