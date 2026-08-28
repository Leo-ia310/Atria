import { Prisma } from '@prisma/client';
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { ChangePlanDto } from './dto/billing.dto';
export declare class BillingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    overview(user: JwtUser): Promise<{
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
        };
        usage: {
            users: number;
            branches: number;
        };
        invoices: {
            number: string;
            id: string;
            currencyCode: string;
            createdAt: Date;
            organizationId: string;
            status: import("@prisma/client").$Enums.LedgerStatus;
            planCode: import("@prisma/client").$Enums.PlanCode;
            periodStart: Date;
            periodEnd: Date;
            amountDue: Prisma.Decimal;
            amountPaid: Prisma.Decimal;
        }[];
    }>;
    changePlan(user: JwtUser, dto: ChangePlanDto): Promise<{
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
        };
        invoice: {
            number: string;
            id: string;
            currencyCode: string;
            createdAt: Date;
            organizationId: string;
            status: import("@prisma/client").$Enums.LedgerStatus;
            planCode: import("@prisma/client").$Enums.PlanCode;
            periodStart: Date;
            periodEnd: Date;
            amountDue: Prisma.Decimal;
            amountPaid: Prisma.Decimal;
        };
    }>;
}
