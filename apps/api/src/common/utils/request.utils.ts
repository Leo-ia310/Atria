import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const cookieNames = {
  access: 'atria_access',
  refresh: 'atria_refresh',
  csrf: 'atria_csrf',
} as const;

export const extractBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.replace('Bearer ', '').trim();
};

export const extractAccessToken = (request: Request): string | null => {
  const cookieToken = request.cookies?.[cookieNames.access] as
    | string
    | undefined;
  const headerToken = extractBearerToken(request.headers.authorization);

  return cookieToken ?? headerToken ?? null;
};

export const extractRefreshToken = (request: Request): string | null => {
  const cookieToken = request.cookies?.[cookieNames.refresh] as
    | string
    | undefined;
  const headerToken = request.headers['x-refresh-token'];

  if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  return cookieToken ?? null;
};

export const getRequestIp = (request: Request): string | null => {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? null;
  }

  return request.ip ?? null;
};

export const getRequestDeviceLabel = (userAgent?: string | null): string => {
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

export const safeTokenCompare = (
  left?: string | null,
  right?: string | null,
): boolean => {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const createRequestId = (): string => randomUUID();

export const parseDurationToMs = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 15 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] ?? multipliers.m);
};

export const extractTenantSlug = (request: Request): string | null => {
  const headerTenant = request.headers['x-tenant-slug'];

  if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
    return headerTenant.trim().toLowerCase();
  }

  const host = request.headers.host;
  if (!host) {
    return null;
  }

  // host puede venir como "acero-norte.atria.app", "localhost:4000",
  // "127.0.0.1:4000" o un IPv6. Quitamos puerto y validamos.
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname) return null;

  // Si solo hay un segmento (sin punto) o el primero es reservado, no hay tenant.
  const parts = hostname.split('.');
  const [subdomain, ...rest] = parts;
  if (
    parts.length < 2 ||
    !subdomain ||
    ['localhost', '127', 'www', '0', '10', '172', '192'].includes(subdomain)
  ) {
    return null;
  }
  // Excluir IPs (ej. 127.0.0.1)
  if (/^\d+$/.test(subdomain) && rest.every((s) => /^\d+$/.test(s))) {
    return null;
  }

  return subdomain;
};
