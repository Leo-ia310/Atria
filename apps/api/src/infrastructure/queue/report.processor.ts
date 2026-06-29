import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

type ReportJobData = {
  exportId: string;
  organizationId: string;
  type: string;
  format: string;
  filters: Record<string, unknown>;
};

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<void> {
    const exportPath =
      this.configService.getOrThrow<string>('REPORT_EXPORT_PATH');
    await mkdir(exportPath, { recursive: true });

    const fileName = `${job.id}-${job.data.type}.${job.data.format}`;
    const fileKey = join(exportPath, fileName);

    await this.prisma.reportExport.update({
      where: { id: job.data.exportId },
      data: { status: 'PROCESSING' },
    });

    const payload = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        organizationId: job.data.organizationId,
        type: job.data.type,
        format: job.data.format,
        filters: job.data.filters,
      },
      null,
      2,
    );

    await writeFile(fileKey, payload, 'utf8');

    await this.prisma.reportExport.update({
      where: { id: job.data.exportId },
      data: {
        status: 'COMPLETED',
        fileKey,
      },
    });
  }
}
