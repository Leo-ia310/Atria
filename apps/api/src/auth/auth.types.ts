import type { Request } from 'express';

export type JwtUser = {
  sub: string;
  email: string;
  organizationId: string;
  tenantSlug: string;
  membershipId: string;
  roleKey: string;
  permissions: string[];
  sessionId: string;
  defaultBranchId?: string | null;
};

export type RequestWithAuth = Request & {
  user?: JwtUser;
  requestId?: string;
  tenantSlug?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};
