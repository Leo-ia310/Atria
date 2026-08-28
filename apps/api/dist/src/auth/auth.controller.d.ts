import type { Response } from 'express';
import type { JwtUser, RequestWithAuth } from './auth.types';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, RevokeSessionDto, VerifyEmailDto } from './dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    revokeSession(user: JwtUser, dto: RevokeSessionDto): Promise<{
        revoked: boolean;
    }>;
}
