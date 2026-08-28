import type { Request } from 'express';
export declare const cookieNames: {
    readonly access: "atria_access";
    readonly refresh: "atria_refresh";
    readonly csrf: "atria_csrf";
};
export declare const extractBearerToken: (authorization?: string) => string | null;
export declare const extractAccessToken: (request: Request) => string | null;
export declare const extractRefreshToken: (request: Request) => string | null;
export declare const getRequestIp: (request: Request) => string | null;
export declare const getRequestDeviceLabel: (userAgent?: string | null) => string;
export declare const safeTokenCompare: (left?: string | null, right?: string | null) => boolean;
export declare const createRequestId: () => string;
export declare const parseDurationToMs: (duration: string) => number;
export declare const extractTenantSlug: (request: Request) => string | null;
