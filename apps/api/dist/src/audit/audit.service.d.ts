import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { StructuredLoggerService } from "../infrastructure/logger/logger.service";
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
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService, logger: StructuredLoggerService);
    log(payload: AuditPayload): Promise<void>;
}
export {};
