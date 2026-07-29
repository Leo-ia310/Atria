import { cache } from "react";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/actions/session-helpers";
import { getAccessContext } from "@/lib/server-access";
import { getSucursalesActivas } from "@/lib/tenant-data";

export const SUCURSAL_SCOPE_COOKIE = "atria:sucursal-scope";

export type SucursalOption = {
  id: string;
  nombre: string;
  esPrincipal: boolean;
};

export type SucursalScope = {
  visible: boolean;
  modo: "all" | "selected";
  sucursales: SucursalOption[];
  sucursalIds: string[];
  etiqueta: string;
};

const getSucursalScopeCached = cache(
  async (
    userId: string,
    empresaId: string,
    rolId: string | null,
    esSuperAdmin: boolean,
  ): Promise<SucursalScope> => {
    const user: SessionUser = {
      id: userId,
      empresaId,
      rolId,
      esSuperAdmin,
      nombre: "",
      email: "",
    };
    const [accessContext, sucs] = await Promise.all([
      getAccessContext(user),
      getSucursalesActivas(empresaId),
    ]);

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
  },
);

export function getSucursalScope(
  user: SessionUser,
): Promise<SucursalScope> {
  return getSucursalScopeCached(
    user.id,
    user.empresaId,
    user.rolId,
    user.esSuperAdmin,
  );
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
