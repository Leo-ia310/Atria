import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type { JwtUser } from '@/auth/auth.types';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateExportDto } from './dto/reports.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('reports') private readonly reportsQueue?: Queue,
  ) {}

  catalog() {
    return [
      {
        key: 'sales-summary',
        name: 'Resumen de ventas',
        formats: ['json', 'pdf', 'xlsx'],
      },
      {
        key: 'inventory-aging',
        name: 'Inventario por antigüedad',
        formats: ['json', 'xlsx'],
      },
      {
        key: 'branch-performance',
        name: 'Rendimiento por sucursal',
        formats: ['json', 'pdf'],
      },
      {
        key: 'financial-overview',
        name: 'Resumen financiero',
        formats: ['json', 'pdf'],
      },
    ];
  }

  async exports(user: JwtUser) {
    return this.prisma.reportExport.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createExport(user: JwtUser, dto: CreateExportDto) {
    const exportRecord = await this.prisma.reportExport.create({
      data: {
        organizationId: user.organizationId,
        type: dto.type,
        format: dto.format,
        filters: dto.filters as Prisma.InputJsonValue,
        requestedByMembershipId: user.membershipId,
      },
    });

    if (this.reportsQueue) {
      await this.reportsQueue.add('generate', {
        exportId: exportRecord.id,
        organizationId: user.organizationId,
        type: dto.type,
        format: dto.format,
        filters: dto.filters,
      });
    } else {
      this.logger.warn(
        `Reporte ${exportRecord.id} no encolado: BullMQ inactivo (QUEUES_ENABLED=false).`,
      );
    }

    return exportRecord;
  }
}
