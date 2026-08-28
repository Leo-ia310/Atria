import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
export declare class UploadsService {
    private readonly prisma;
    private readonly configService;
    private readonly uploadsQueue?;
    private readonly logger;
    constructor(prisma: PrismaService, configService: ConfigService, uploadsQueue?: Queue | undefined);
    upload(user: JwtUser, module: string, file: Express.Multer.File): Promise<{
        id: string;
        createdAt: Date;
        organizationId: string;
        status: import("@prisma/client").$Enums.FileStatus;
        module: string;
        uploadedById: string | null;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        storageKey: string;
        checksum: string | null;
    }>;
}
