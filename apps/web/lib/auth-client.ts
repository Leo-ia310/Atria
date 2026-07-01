/**
 * Helpers de autenticación que envuelven el apiClient.
 * Hablan con los endpoints /auth/* del API NestJS.
 */

import { apiClient, setTenantSlug, clearTenantSlug } from "./api-client";

export type RegisterPayload = {
  companyName: string;
  legalName: string;
  businessType: "HARDWARE" | "PHARMACY" | "RETAIL" | "DISTRIBUTOR" | "MEDICAL_SUPPLY" | "OTHER";
  /** Opcional. Si se omite el servidor lo genera desde companyName. */
  tenantSlug?: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  primaryBranch: { name: string };
};

export type LoginPayload = {
  email: string;
  password: string;
  /** Opcional. Si se omite, el servidor selecciona la membresía activa más reciente. */
  tenantSlug?: string;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  roleKey: string;
  permissions: string[];
};

export async function login(payload: LoginPayload): Promise<SessionUser> {
  if (payload.tenantSlug) setTenantSlug(payload.tenantSlug);
  const res = await apiClient.post<{
    user: SessionUser;
    organization?: { slug: string };
  }>("/auth/login", payload);
  if (res.organization?.slug) setTenantSlug(res.organization.slug);
  return res.user;
}

export async function register(payload: RegisterPayload): Promise<SessionUser> {
  if (payload.tenantSlug) setTenantSlug(payload.tenantSlug);
  const res = await apiClient.post<{
    user: SessionUser;
    organization?: { slug: string };
  }>("/auth/register", payload);
  if (res.organization?.slug) setTenantSlug(res.organization.slug);
  return res.user;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout").catch(() => {
    // ignoramos errores — la sesión local debe limpiarse igual
  });
  clearTenantSlug();
}

export async function me(): Promise<SessionUser> {
  return apiClient.get<SessionUser>("/auth/me");
}

export async function forgotPassword(email: string, tenantSlug: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email, tenantSlug });
}
