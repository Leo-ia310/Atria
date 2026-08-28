import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { RedisService } from "../infrastructure/redis/redis.service";
export declare class HealthController {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    status(): Promise<{
        status: string;
        services: {
            database: string;
            redis: string;
        };
        timestamp: string;
    }>;
}
