"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTenantSlug = exports.parseDurationToMs = exports.createRequestId = exports.safeTokenCompare = exports.getRequestDeviceLabel = exports.getRequestIp = exports.extractRefreshToken = exports.extractAccessToken = exports.extractBearerToken = exports.cookieNames = void 0;
const node_crypto_1 = require("node:crypto");
exports.cookieNames = {
    access: 'atria_access',
    refresh: 'atria_refresh',
    csrf: 'atria_csrf',
};
const extractBearerToken = (authorization) => {
    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }
    return authorization.replace('Bearer ', '').trim();
};
exports.extractBearerToken = extractBearerToken;
const extractAccessToken = (request) => {
    const cookieToken = request.cookies?.[exports.cookieNames.access];
    const headerToken = (0, exports.extractBearerToken)(request.headers.authorization);
    return cookieToken ?? headerToken ?? null;
};
exports.extractAccessToken = extractAccessToken;
const extractRefreshToken = (request) => {
    const cookieToken = request.cookies?.[exports.cookieNames.refresh];
    const headerToken = request.headers['x-refresh-token'];
    if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
        return headerToken.trim();
    }
    return cookieToken ?? null;
};
exports.extractRefreshToken = extractRefreshToken;
const getRequestIp = (request) => {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() ?? null;
    }
    return request.ip ?? null;
};
exports.getRequestIp = getRequestIp;
const getRequestDeviceLabel = (userAgent) => {
    if (!userAgent) {
        return 'Desconocido';
    }
    if (userAgent.includes('Mobile')) {
        return 'Móvil';
    }
    if (userAgent.includes('Windows')) {
        return 'Escritorio Windows';
    }
    if (userAgent.includes('Macintosh')) {
        return 'Escritorio macOS';
    }
    return 'Navegador web';
};
exports.getRequestDeviceLabel = getRequestDeviceLabel;
const safeTokenCompare = (left, right) => {
    if (!left || !right) {
        return false;
    }
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
};
exports.safeTokenCompare = safeTokenCompare;
const createRequestId = () => (0, node_crypto_1.randomUUID)();
exports.createRequestId = createRequestId;
const parseDurationToMs = (duration) => {
    const match = duration.match(/^(\d+)([smhd])$/i);
    if (!match) {
        return 15 * 60 * 1000;
    }
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? multipliers.m);
};
exports.parseDurationToMs = parseDurationToMs;
const extractTenantSlug = (request) => {
    const headerTenant = request.headers['x-tenant-slug'];
    if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
        return headerTenant.trim().toLowerCase();
    }
    const host = request.headers.host;
    if (!host) {
        return null;
    }
    const hostname = host.split(':')[0]?.toLowerCase() ?? '';
    if (!hostname)
        return null;
    const parts = hostname.split('.');
    const [subdomain, ...rest] = parts;
    if (parts.length < 2 ||
        !subdomain ||
        ['localhost', '127', 'www', '0', '10', '172', '192'].includes(subdomain)) {
        return null;
    }
    if (/^\d+$/.test(subdomain) && rest.every((s) => /^\d+$/.test(s))) {
        return null;
    }
    return subdomain;
};
exports.extractTenantSlug = extractTenantSlug;
//# sourceMappingURL=request.utils.js.map