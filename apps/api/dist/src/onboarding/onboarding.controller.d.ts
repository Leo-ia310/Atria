import type { JwtUser } from "../auth/auth.types";
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    state(user: JwtUser): Promise<{
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
        branch: {
            id: string;
            countryCode: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            organizationId: string;
            code: string;
            phone: string | null;
            email: string | null;
            addressLine1: string;
            city: string;
            isPrimary: boolean;
        } | null;
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
        completed: boolean;
    }>;
    complete(user: JwtUser, dto: CompleteOnboardingDto): Promise<{
        completed: boolean;
    }>;
}
