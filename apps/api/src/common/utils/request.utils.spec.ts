import type { Request } from 'express';
import {
  cookieNames,
  extractBearerToken,
  extractAccessToken,
  extractRefreshToken,
  extractTenantSlug,
  getRequestDeviceLabel,
  parseDurationToMs,
  safeTokenCompare,
} from './request.utils';

const buildRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    cookies: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
};

describe('request.utils', () => {
  describe('extractBearerToken', () => {
    it('devuelve el token cuando el header tiene formato Bearer', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    });
    it('devuelve null cuando no hay Bearer', () => {
      expect(extractBearerToken('abc123')).toBeNull();
      expect(extractBearerToken(undefined)).toBeNull();
    });
  });

  describe('extractAccessToken', () => {
    it('prefiere la cookie sobre el header', () => {
      const req = buildRequest({
        cookies: { [cookieNames.access]: 'cookie-tok' },
        headers: { authorization: 'Bearer header-tok' },
      });
      expect(extractAccessToken(req)).toBe('cookie-tok');
    });
    it('cae al header si no hay cookie', () => {
      const req = buildRequest({ headers: { authorization: 'Bearer header-tok' } });
      expect(extractAccessToken(req)).toBe('header-tok');
    });
    it('devuelve null si no hay ni cookie ni header', () => {
      expect(extractAccessToken(buildRequest())).toBeNull();
    });
  });

  describe('extractRefreshToken', () => {
    it('prefiere el header x-refresh-token sobre la cookie', () => {
      const req = buildRequest({
        cookies: { [cookieNames.refresh]: 'cookie-r' },
        headers: { 'x-refresh-token': 'header-r' },
      });
      expect(extractRefreshToken(req)).toBe('header-r');
    });
    it('cae a la cookie cuando no hay header', () => {
      const req = buildRequest({ cookies: { [cookieNames.refresh]: 'cookie-r' } });
      expect(extractRefreshToken(req)).toBe('cookie-r');
    });
  });

  describe('parseDurationToMs', () => {
    it('parsea segundos', () => {
      expect(parseDurationToMs('30s')).toBe(30_000);
    });
    it('parsea minutos', () => {
      expect(parseDurationToMs('15m')).toBe(15 * 60_000);
    });
    it('parsea horas', () => {
      expect(parseDurationToMs('2h')).toBe(2 * 60 * 60_000);
    });
    it('parsea días', () => {
      expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60_000);
    });
    it('cae al default 15m si el formato es inválido', () => {
      expect(parseDurationToMs('invalido')).toBe(15 * 60_000);
    });
  });

  describe('safeTokenCompare', () => {
    it('devuelve true para tokens iguales', () => {
      expect(safeTokenCompare('token-abc', 'token-abc')).toBe(true);
    });
    it('devuelve false para tokens distintos', () => {
      expect(safeTokenCompare('token-abc', 'token-xyz')).toBe(false);
    });
    it('devuelve false para tokens de distinta longitud', () => {
      expect(safeTokenCompare('abc', 'abcdef')).toBe(false);
    });
    it('devuelve false cuando alguno es null', () => {
      expect(safeTokenCompare(null, 'abc')).toBe(false);
      expect(safeTokenCompare('abc', null)).toBe(false);
      expect(safeTokenCompare(null, null)).toBe(false);
    });
  });

  describe('getRequestDeviceLabel', () => {
    it('detecta Mobile', () => {
      expect(getRequestDeviceLabel('Mozilla Mobile')).toBe('Móvil');
    });
    it('detecta Windows', () => {
      expect(getRequestDeviceLabel('Windows NT')).toBe('Escritorio Windows');
    });
    it('detecta Macintosh', () => {
      expect(getRequestDeviceLabel('Macintosh')).toBe('Escritorio macOS');
    });
    it('cae a Desconocido si no hay UA', () => {
      expect(getRequestDeviceLabel(null)).toBe('Desconocido');
    });
    it('cae a Navegador web cuando no matchea ningún patrón', () => {
      expect(getRequestDeviceLabel('Linux X11')).toBe('Navegador web');
    });
  });

  describe('extractTenantSlug', () => {
    it('prefiere el header x-tenant-slug normalizado', () => {
      const req = buildRequest({ headers: { 'x-tenant-slug': '  Acero-Norte  ' } });
      expect(extractTenantSlug(req)).toBe('acero-norte');
    });
    it('extrae del subdomain como fallback', () => {
      const req = buildRequest({ headers: { host: 'acero.atria.app' } });
      expect(extractTenantSlug(req)).toBe('acero');
    });
    it('ignora subdomains reservados', () => {
      expect(extractTenantSlug(buildRequest({ headers: { host: 'www.atria.app' } }))).toBeNull();
      expect(
        extractTenantSlug(buildRequest({ headers: { host: 'localhost:3000' } })),
      ).toBeNull();
    });
  });
});
