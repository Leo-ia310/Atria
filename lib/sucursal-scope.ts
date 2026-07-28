import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sucursales } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/actions/session-helpers";
import { getAccessContext, type AccessContext } from "@/lib/server-access";

export const SUCURSAL_SCOPE_COOKIE = "atria:sucursal-scope";

export type SucursalOption = {
  id: string;
  nombre: string;
};

export type SucursalScope = {
  visible: boolean;
  modo: "all" | "selected";
  sucursales: SucursalOption[];
  sucursalIds: string[];
  etiqueta: string;
};

export async function getSucursalScope(
  user: SessionUser,
  access?: AccessContext,
): Promise<SucursalScope> {
  const accessContext = access ?? (await getAccessContext(user));
  const sucs = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.empresaId, user.empresaId),
        eq(sucursales.activa, true),
        isNull(sucursales.eliminadoEn),
      ),
    )
    .orderBy(sucursales.nombre);

  const allIds = sucs.map((s) => s.id);
  const visible =
    accessContext.esAdminEmpresa &&
    accessContext.plan.features.multi_sucursal &&
    sucs.length > 1;

  if (!visible) {
    return {
      visible: false,
      modo: "all",
      sucursales: sucs,
      sucursalIds: allIds,
      etiqueta: "Todas las sucursales",
    };
  }

  const rawValue = (await cookies()).get(SUCURSAL_SCOPE_COOKIE)?.value;
  const value = rawValue ? safeDecode(rawValue) : null;
  if (!value || value === "all") {
    return {
      visible: true,
      modo: "all",
      sucursales: sucs,
      sucursalIds: allIds,
      etiqueta: "Todas las sucursales",
    };
  }

  const validIds = new Set(allIds);
  const selected = value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => validIds.has(id));

  if (selected.length === 0 || selected.length === allIds.length) {
    return {
      visible: true,
      modo: "all",
      sucursales: sucs,
      sucursalIds: allIds,
      etiqueta: "Todas las sucursales",
    };
  }

  return {
    visible: true,
    modo: "selected",
    sucursales: sucs,
    sucursalIds: selected,
    etiqueta: `${selected.length} sucursal${selected.length === 1 ? "" : "es"}`,
  };
}

export function selectedSucursalIds(scope: SucursalScope): string[] | null {
  return scope.visible && scope.modo === "selected" ? scope.sucursalIds : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
