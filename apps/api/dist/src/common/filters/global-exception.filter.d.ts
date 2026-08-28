import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { StructuredLoggerService } from "../../infrastructure/logger/logger.service";
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger;
    constructor(logger: StructuredLoggerService);
    catch(exception: unknown, host: ArgumentsHost): void;
}
