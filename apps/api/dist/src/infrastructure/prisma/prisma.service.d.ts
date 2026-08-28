import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StructuredLoggerService } from "../logger/logger.service";
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    constructor(logger: StructuredLoggerService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
