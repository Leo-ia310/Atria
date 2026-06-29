import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { StructuredLoggerService } from '@/infrastructure/logger/logger.service';

type AuditPayload = {
  organizationId?: string | null;
  actorId?: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async log(payload: AuditPayload): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId ?? undefined,
        actorId: payload.actorId ?? undefined,
        module: payload.module,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId ?? undefined,
        ipAddress: payload.ipAddress ?? undefined,
        userAgent: payload.userAgent ?? undefined,
        metadata: payload.metadata
          ? (payload.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });

    this.logger.audit('Audit event', payload);
  }
}
