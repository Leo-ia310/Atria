import { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithAuth } from "../../auth/auth.types";
export declare class RequestContextMiddleware implements NestMiddleware {
    use(request: RequestWithAuth, response: Response, next: NextFunction): void;
}
