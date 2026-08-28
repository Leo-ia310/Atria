import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from "../prisma/prisma.service";
type UploadJobData = {
    fileAssetId: string;
};
export declare class UploadProcessor extends WorkerHost {
    private readonly prisma;
    constructor(prisma: PrismaService);
    process(job: Job<UploadJobData>): Promise<void>;
}
export {};
