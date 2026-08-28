import type { JwtUser } from "../auth/auth.types";
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/billing.dto';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
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
            amountDue: import("@prisma/client/runtime/library").Decimal;
            amountPaid: import("@prisma/client/runtime/library").Decimal;
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
            amountDue: import("@prisma/client/runtime/library").Decimal;
            amountPaid: import("@prisma/client/runtime/library").Decimal;
        };
    }>;
}
