import { WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from "../prisma/prisma.service";
type ReportJobData = {
    exportId: string;
    organizationId: string;
    type: string;
    format: string;
    filters: Record<string, unknown>;
};
export declare class ReportProcessor extends WorkerHost {
    private readonly prisma;
    private readonly configService;
    constructor(prisma: PrismaService, configService: ConfigService);
    process(job: Job<ReportJobData>): Promise<void>;
}
export {};
