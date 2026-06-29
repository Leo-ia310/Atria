import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { ChangePlanDto } from './dto/billing.dto';

const decimal = (value: number) => new Prisma.Decimal(value);

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: JwtUser) {
    const [subscription, invoices, usersCount, branchCount] = await Promise.all(
      [
        this.prisma.subscription.findUniqueOrThrow({
          where: { organizationId: user.organizationId },
        }),
        this.prisma.billingInvoice.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
        this.prisma.membership.count({
          where: { organizationId: user.organizationId, deletedAt: null },
        }),
        this.prisma.branch.count({
          where: { organizationId: user.organizationId, deletedAt: null },
        }),
      ],
    );

    return {
      subscription,
      usage: {
        users: usersCount,
        branches: branchCount,
      },
      invoices,
    };
  }

  async changePlan(user: JwtUser, dto: ChangePlanDto) {
    const [usersCount, branchCount] = await Promise.all([
      this.prisma.membership.count({
        where: { organizationId: user.organizationId, deletedAt: null },
      }),
      this.prisma.branch.count({
        where: { organizationId: user.organizationId, deletedAt: null },
      }),
    ]);

    if (dto.planCode === 'BUSINESS' && (usersCount > 3 || branchCount > 1)) {
      throw new ForbiddenException(
        'No puedes volver a Business mientras excedas sus límites de usuarios o sucursales.',
      );
    }

    const billingCount = await this.prisma.billingInvoice.count({
      where: { organizationId: user.organizationId },
    });

    const [subscription, invoice] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { organizationId: user.organizationId },
        data: {
          planCode: dto.planCode,
          status: 'ACTIVE',
          apiAccessEnabled: dto.planCode === 'ENTERPRISE',
        },
      }),
      this.prisma.billingInvoice.create({
        data: {
          organizationId: user.organizationId,
          number: `BILL-${String(billingCount + 1).padStart(6, '0')}`,
          planCode: dto.planCode,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amountDue: decimal(dto.planCode === 'ENTERPRISE' ? 399 : 99),
          currencyCode: 'USD',
        },
      }),
    ]);

    return { subscription, invoice };
  }
}
