import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async state(user: JwtUser) {
    const [organization, taxes, branch, subscription] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      }),
      this.prisma.taxRate.findMany({
        where: { organizationId: user.organizationId },
      }),
      this.prisma.branch.findFirst({
        where: { organizationId: user.organizationId, isPrimary: true },
      }),
      this.prisma.subscription.findUnique({
        where: { organizationId: user.organizationId },
      }),
    ]);

    return {
      organization,
      taxes,
      branch,
      subscription,
      completed: Boolean(organization.onboardingCompletedAt),
    };
  }

  async complete(user: JwtUser, dto: CompleteOnboardingDto) {
    return this.prisma.$transaction(async (transaction) => {
      const primaryBranch = await transaction.branch.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          isPrimary: true,
        },
      });

      await transaction.organization.update({
        where: { id: user.organizationId },
        data: {
          businessType: dto.businessType as never,
          countryCode: dto.countryCode.toUpperCase(),
          currencyCode: dto.currencyCode.toUpperCase(),
          timezone: dto.timezone,
          onboardingCompletedAt: new Date(),
        },
      });

      await transaction.branch.update({
        where: { id: primaryBranch.id },
        data: { name: dto.primaryBranchName },
      });

      await Promise.all(
        dto.taxes.map((tax, index) =>
          transaction.taxRate.upsert({
            where: {
              organizationId_code: {
                organizationId: user.organizationId,
                code: tax.code,
              },
            },
            update: {
              name: tax.name,
              rate: new Prisma.Decimal(tax.rate),
              scope: tax.scope,
              isDefault: index === 0,
            },
            create: {
              organizationId: user.organizationId,
              code: tax.code,
              name: tax.name,
              rate: new Prisma.Decimal(tax.rate),
              scope: tax.scope,
              isDefault: index === 0,
            },
          }),
        ),
      );

      const roles = await transaction.role.findMany({
        where: { organizationId: user.organizationId },
      });
      const primaryWarehouse = await transaction.warehouse.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          isPrimary: true,
        },
      });
      const defaultTax = await transaction.taxRate.findFirstOrThrow({
        where: {
          organizationId: user.organizationId,
          isDefault: true,
        },
      });

      for (const initialUser of dto.initialUsers) {
        const role = roles.find(
          (candidate) => candidate.key === initialUser.roleKey,
        );
        if (!role) {
          continue;
        }

        const passwordHash = await argon2.hash(initialUser.password);
        const createdUser = await transaction.user.upsert({
          where: { email: initialUser.email.toLowerCase() },
          update: {
            firstName: initialUser.firstName,
            lastName: initialUser.lastName,
            passwordHash,
          },
          create: {
            email: initialUser.email.toLowerCase(),
            firstName: initialUser.firstName,
            lastName: initialUser.lastName,
            passwordHash,
          },
        });

        const membership = await transaction.membership.upsert({
          where: {
            organizationId_userId: {
              organizationId: user.organizationId,
              userId: createdUser.id,
            },
          },
          update: {
            roleId: role.id,
            defaultBranchId: primaryBranch.id,
          },
          create: {
            organizationId: user.organizationId,
            userId: createdUser.id,
            roleId: role.id,
            defaultBranchId: primaryBranch.id,
          },
        });

        await transaction.employeeProfile.upsert({
          where: { membershipId: membership.id },
          update: {
            branchId: primaryBranch.id,
            jobTitle: initialUser.jobTitle ?? 'Operación',
          },
          create: {
            organizationId: user.organizationId,
            membershipId: membership.id,
            branchId: primaryBranch.id,
            employeeCode: `EMP-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
            jobTitle: initialUser.jobTitle ?? 'Operación',
            hireDate: new Date(),
          },
        });
      }

      for (const initialProduct of dto.initialProducts) {
        const category = initialProduct.categoryName
          ? await transaction.category.upsert({
              where: {
                organizationId_name: {
                  organizationId: user.organizationId,
                  name: initialProduct.categoryName,
                },
              },
              update: {},
              create: {
                organizationId: user.organizationId,
                name: initialProduct.categoryName,
              },
            })
          : null;

        const product = await transaction.product.upsert({
          where: {
            organizationId_sku: {
              organizationId: user.organizationId,
              sku: initialProduct.sku,
            },
          },
          update: {
            name: initialProduct.name,
            salePrice: new Prisma.Decimal(initialProduct.salePrice),
            costPrice: new Prisma.Decimal(initialProduct.costPrice),
            minStock: new Prisma.Decimal(initialProduct.minStock),
            categoryId: category?.id,
            taxRateId: defaultTax.id,
          },
          create: {
            organizationId: user.organizationId,
            sku: initialProduct.sku,
            name: initialProduct.name,
            unit: 'unidad',
            salePrice: new Prisma.Decimal(initialProduct.salePrice),
            costPrice: new Prisma.Decimal(initialProduct.costPrice),
            minStock: new Prisma.Decimal(initialProduct.minStock),
            categoryId: category?.id,
            taxRateId: defaultTax.id,
          },
        });

        await transaction.productInventory.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: primaryWarehouse.id,
              productId: product.id,
            },
          },
          update: {},
          create: {
            organizationId: user.organizationId,
            productId: product.id,
            warehouseId: primaryWarehouse.id,
            availableQty: new Prisma.Decimal(initialProduct.minStock * 2),
            averageCost: new Prisma.Decimal(initialProduct.costPrice),
          },
        });
      }

      return { completed: true };
    });
  }
}
