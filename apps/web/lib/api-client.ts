/**
 * Cliente HTTP del API NestJS de Atria.
 *
 * Maneja:
 * - Cookies httpOnly (atria_access, atria_refresh, atria_csrf) — el browser las envía automáticamente.
 * - CSRF: lee la cookie `atria_csrf` (NO httpOnly) y la replica en header `x-csrf-token` para mutaciones.
 * - Tenant: header `x-tenant-slug` configurable por sesión.
 * - Refresh automático: en 401 intenta POST /auth/refresh una vez antes de propagar el error.
 *
 * Uso:
 *   const me = await apiClient.get<{ id: string; email: string }>("/auth/me");
 *   await apiClient.post("/auth/logout");
 */

const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL ?? "http://localhost:4000/api/v1"
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const CSRF_COOKIE = "atria_csrf";
const TENANT_STORAGE_KEY = "atria_tenant_slug";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiDisabledError extends ApiError {
  constructor() {
    super(503, "API_DISABLED", "API deshabilitada (modo desarrollo frontend)");
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  /** Si true, NO intenta refresh al recibir 401. Usado internamente por refresh(). */
  skipRefresh?: boolean;
  /** Override del tenant slug — por defecto se lee de localStorage. */
  tenantSlug?: string;
  /** AbortSignal para cancelar. */
  signal?: AbortSignal;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function getTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TENANT_STORAGE_KEY);
}

export function setTenantSlug(slug: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TENANT_STORAGE_KEY, slug);
}

export function clearTenantSlug(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TENANT_STORAGE_KEY);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiEnabled =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_ENABLED !== "false"
      : true;
  if (!apiEnabled) {
    throw new ApiDisabledError();
  }

  const method = options.method ?? "GET";
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...(options.headers ?? {}),
  };

  const tenant = options.tenantSlug ?? getTenantSlug();
  if (tenant) headers["x-tenant-slug"] = tenant;

  if (method !== "GET") {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    throw new ApiError(0, "NETWORK", "No pudimos conectar con el servidor", err);
  }

  if (res.status === 401 && !options.skipRefresh && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const errPayload = (payload ?? {}) as {
      message?: string | string[];
      code?: string;
      error?: string;
    };
    const message = Array.isArray(errPayload.message)
      ? errPayload.message.join(", ")
      : errPayload.message ?? errPayload.error ?? `Error ${res.status}`;
    throw new ApiError(res.status, errPayload.code ?? null, message, payload);
  }

  return payload as T;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      await request("/auth/refresh", { method: "POST", skipRefresh: true });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
