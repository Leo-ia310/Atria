import type { JwtUser } from "../auth/auth.types";
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    company(user: JwtUser): Promise<{
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
        settings: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            invoicePrefix: string;
            quotePrefix: string;
            themePrimary: string;
            themeSecondary: string;
            posAllowDiscounts: boolean;
            posRequireCustomer: boolean;
            notifications: import("@prisma/client/runtime/library").JsonValue;
            security: import("@prisma/client/runtime/library").JsonValue;
            invoiceTemplate: import("@prisma/client/runtime/library").JsonValue;
        };
        taxes: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            organizationId: string;
            code: string;
            rate: import("@prisma/client/runtime/library").Decimal;
            scope: import("@prisma/client").$Enums.TaxScope;
            isDefault: boolean;
        }[];
        subscription: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            planCode: import("@prisma/client").$Enums.PlanCode;
            activeFrom: Date;
            renewsAt: Date | null;
            seatsUsed: number;
            branchesUsed: number;
            apiAccessEnabled: boolean;
        } | null;
    }>;
    update(user: JwtUser, dto: UpdateSettingsDto): Promise<{
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
        settings: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            invoicePrefix: string;
            quotePrefix: string;
            themePrimary: string;
            themeSecondary: string;
            posAllowDiscounts: boolean;
            posRequireCustomer: boolean;
            notifications: import("@prisma/client/runtime/library").JsonValue;
            security: import("@prisma/client/runtime/library").JsonValue;
            invoiceTemplate: import("@prisma/client/runtime/library").JsonValue;
        };
    }>;
    security(user: JwtUser): Promise<{
        sessions: {
            id: string;
            createdAt: Date;
            organizationId: string;
            userId: string;
            membershipId: string;
            ipAddress: string | null;
            userAgent: string | null;
            refreshTokenHash: string;
            deviceLabel: string;
            csrfTokenHash: string;
            lastSeenAt: Date;
            expiresAt: Date;
            revokedAt: Date | null;
        }[];
        apiCredentials: {
            id: string;
            createdAt: Date;
            name: string;
            organizationId: string;
            scopes: string[];
            revokedAt: Date | null;
            keyHash: string;
            lastUsedAt: Date | null;
        }[];
        recentSecurityEvents: {
            id: string;
            createdAt: Date;
            organizationId: string | null;
            module: string;
            action: string;
            entityType: string;
            entityId: string | null;
            ipAddress: string | null;
            userAgent: string | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            actorId: string | null;
        }[];
    }>;
}
