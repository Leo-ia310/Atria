import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    private readonly logger;
    private readonly client;
    private connected;
    constructor(configService: ConfigService);
    getClient(): Redis;
    isAvailable(): boolean;
    onModuleDestroy(): Promise<void>;
}
