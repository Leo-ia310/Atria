import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CreateExportDto } from './dto/reports.dto';
export declare class ReportsService {
    private readonly prisma;
    private readonly reportsQueue?;
    private readonly logger;
    constructor(prisma: PrismaService, reportsQueue?: Queue | undefined);
    catalog(): {
        key: string;
        name: string;
        formats: string[];
    }[];
    exports(user: JwtUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        status: import("@prisma/client").$Enums.ExportStatus;
        type: string;
        format: string;
        filters: Prisma.JsonValue;
        fileKey: string | null;
        requestedByMembershipId: string | null;
    }[]>;
    createExport(user: JwtUser, dto: CreateExportDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        status: import("@prisma/client").$Enums.ExportStatus;
        type: string;
        format: string;
        filters: Prisma.JsonValue;
        fileKey: string | null;
        requestedByMembershipId: string | null;
    }>;
}
