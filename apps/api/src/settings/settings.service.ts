import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private jsonInput(
    value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === null || value === undefined) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  async company(user: JwtUser) {
    const [organization, settings, taxes, subscription] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
      }),
      this.prisma.companySetting.findUniqueOrThrow({
        where: { organizationId: user.organizationId },
      }),
      this.prisma.taxRate.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.subscription.findUnique({
        where: { organizationId: user.organizationId },
      }),
    ]);

    return {
      organization,
      settings,
      taxes,
      subscription,
    };
  }

  async update(user: JwtUser, dto: UpdateSettingsDto) {
    return this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.update({
        where: { id: user.organizationId },
        data: {
          displayName: dto.displayName,
          legalName: dto.legalName,
        },
      });

      const current = await transaction.companySetting.findUniqueOrThrow({
        where: { organizationId: user.organizationId },
      });

      const settings = await transaction.companySetting.update({
        where: { organizationId: user.organizationId },
        data: {
          invoicePrefix: dto.invoicePrefix ?? current.invoicePrefix,
          quotePrefix: dto.quotePrefix ?? current.quotePrefix,
          themePrimary: dto.themePrimary ?? current.themePrimary,
          themeSecondary: dto.themeSecondary ?? current.themeSecondary,
          posAllowDiscounts: dto.posAllowDiscounts ?? current.posAllowDiscounts,
          posRequireCustomer:
            dto.posRequireCustomer ?? current.posRequireCustomer,
          notifications: this.jsonInput(
            dto.notifications ?? current.notifications,
          ),
          security: this.jsonInput(dto.security ?? current.security),
          invoiceTemplate: this.jsonInput(
            dto.invoiceTemplate ?? current.invoiceTemplate,
          ),
        },
      });

      return { organization, settings };
    });
  }

  async security(user: JwtUser) {
    const [sessions, apiCredentials, auditLogs] = await Promise.all([
      this.prisma.deviceSession.findMany({
        where: {
          organizationId: user.organizationId,
          revokedAt: null,
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
      }),
      this.prisma.apiCredential.findMany({
        where: {
          organizationId: user.organizationId,
          revokedAt: null,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    return {
      sessions,
      apiCredentials,
      recentSecurityEvents: auditLogs,
    };
  }
}
