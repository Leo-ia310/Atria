import { Injectable } from '@nestjs/common';
import { Prisma, type BusinessType } from '@prisma/client';
import { BASE_CHART_OF_ACCOUNTS, roleTemplates } from '@atria/contracts';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

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

@Injectable()
export class OrganizationProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(
    transaction: Prisma.TransactionClient,
    input: ProvisionTenantInput,
  ): Promise<{
    organization: { id: string; slug: string; displayName: string };
    ownerRoleId: string;
    primaryBranchId: string;
    primaryWarehouseId: string;
  }> {
    const organization = await transaction.organization.create({
      data: {
        slug: input.slug,
        displayName: input.displayName,
        legalName: input.legalName,
        businessType: input.businessType,
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
        timezone: input.timezone,
      },
      select: { id: true, slug: true, displayName: true },
    });

    const roles = await Promise.all(
      Object.entries(roleTemplates).map(([key, permissions]) =>
        transaction.role.create({
          data: {
            organizationId: organization.id,
            key,
            name:
              key === 'owner'
                ? 'Propietario'
                : key === 'admin'
                  ? 'Administrador'
                  : key === 'worker'
                    ? 'Operador'
                    : 'Contabilidad',
            isSystem: true,
            permissions,
          },
        }),
      ),
    );

    const primaryBranch = await transaction.branch.create({
      data: {
        organizationId: organization.id,
        code: 'CENTRAL',
        name: input.primaryBranchName,
        addressLine1: 'A definir',
        city: 'A definir',
        countryCode: input.countryCode,
        isPrimary: true,
      },
    });

    const primaryWarehouse = await transaction.warehouse.create({
      data: {
        organizationId: organization.id,
        branchId: primaryBranch.id,
        code: 'BOD-CENTRAL',
        name: 'Bodega principal',
        isPrimary: true,
      },
    });

    await transaction.taxRate.create({
      data: {
        organizationId: organization.id,
        code: 'GENERAL',
        name: 'Impuesto general',
        rate: new Prisma.Decimal(0),
        scope: 'BOTH',
        isDefault: true,
      },
    });

    await transaction.companySetting.create({
      data: {
        organizationId: organization.id,
        invoicePrefix: 'FAC',
        quotePrefix: 'COT',
        themePrimary: '#2B1F3A',
        themeSecondary: '#A18BCF',
        posAllowDiscounts: true,
        posRequireCustomer: false,
        notifications: {
          stockAlerts: true,
          emailSummaries: true,
          shiftClosures: true,
        },
        security: {
          enforce2fa: false,
          sessionTimeoutMinutes: 60,
          passwordRotationDays: 90,
        },
        invoiceTemplate: {
          showLogo: true,
          footer: 'Gracias por confiar en Atria.',
        },
      },
    });

    await transaction.subscription.create({
      data: {
        organizationId: organization.id,
        planCode: 'BUSINESS',
        status: 'TRIAL',
        activeFrom: new Date(),
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        seatsUsed: 1,
        branchesUsed: 1,
        apiAccessEnabled: false,
      },
    });

    await this.seedDefaultChartOfAccounts(transaction, organization.id);

    const ownerRole = roles.find((role) => role.key === 'owner') ?? roles[0];

    return {
      organization,
      ownerRoleId: ownerRole.id,
      primaryBranchId: primaryBranch.id,
      primaryWarehouseId: primaryWarehouse.id,
    };
  }

  async seedDefaultChartOfAccounts(
    transaction: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const codeToId = new Map<string, string>();
    for (const cuenta of BASE_CHART_OF_ACCOUNTS) {
      const created = await transaction.account.create({
        data: {
          organizationId,
          code: cuenta.code,
          name: cuenta.name,
          type: cuenta.type,
          level: cuenta.level,
          allowsPosting: cuenta.isDetail,
        },
      });
      codeToId.set(cuenta.code, created.id);
    }
    for (const cuenta of BASE_CHART_OF_ACCOUNTS) {
      if (!cuenta.parentCode) continue;
      const parentId = codeToId.get(cuenta.parentCode);
      const selfId = codeToId.get(cuenta.code);
      if (parentId && selfId) {
        await transaction.account.update({
          where: { id: selfId },
          data: { parentId },
        });
      }
    }
  }
}
