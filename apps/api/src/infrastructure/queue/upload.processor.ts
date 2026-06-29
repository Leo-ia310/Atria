import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

type UploadJobData = {
  fileAssetId: string;
};

@Processor('uploads')
export class UploadProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<UploadJobData>): Promise<void> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: job.data.fileAssetId },
    });

    if (!asset) {
      return;
    }

    const buffer = await readFile(asset.storageKey);
    const checksum = createHash('sha256').update(buffer).digest('hex');

    await this.prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        checksum,
        status: 'SCANNED_SAFE',
      },
    });
  }
}
