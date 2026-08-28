import { LoggerService as NestLoggerService } from '@nestjs/common';
export declare class StructuredLoggerService implements NestLoggerService {
    private write;
    log(message: unknown, meta?: unknown): void;
    error(message: unknown, meta?: unknown): void;
    warn(message: unknown, meta?: unknown): void;
    debug(message: unknown, meta?: unknown): void;
    verbose(message: unknown, meta?: unknown): void;
    audit(message: unknown, meta?: unknown): void;
}
