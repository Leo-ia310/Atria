import { Prisma, type BusinessType } from '@prisma/client';
import { PrismaService } from "../infrastructure/prisma/prisma.service";
type ProvisionTenantInput = {
    slug: string;
    displayName: string;
    legalName: string;
    businessType: BusinessType;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    primaryBranchName: string;
};
export declare class OrganizationProvisioningService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    provision(transaction: Prisma.TransactionClient, input: ProvisionTenantInput): Promise<{
        organization: {
            id: string;
            slug: string;
            displayName: string;
        };
        ownerRoleId: string;
        primaryBranchId: string;
        primaryWarehouseId: string;
    }>;
    seedDefaultChartOfAccounts(transaction: Prisma.TransactionClient, organizationId: string): Promise<void>;
}
export {};
