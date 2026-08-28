import type { JwtUser } from "../auth/auth.types";
import { CreateExportDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
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
        filters: import("@prisma/client/runtime/library").JsonValue;
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
        filters: import("@prisma/client/runtime/library").JsonValue;
        fileKey: string | null;
        requestedByMembershipId: string | null;
    }>;
}
