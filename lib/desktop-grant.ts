import { createHmac } from "node:crypto";

export type DesktopGrantPayload = {
  userId: string;
  empresaId: string;
  sucursalIds: string[];
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
};

export function firmarGrantCanonico(
  secret: string,
  grant: DesktopGrantPayload,
): string {
  const canonico = [
    grant.userId,
    grant.empresaId,
    grant.sucursalIds.join(","),
    grant.deviceId,
    grant.issuedAt,
    grant.expiresAt,
  ].join("\n");

  return createHmac("sha256", secret).update(canonico).digest("hex");
}
