import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  facturas,
  permisos,
  planes,
  productos,
  roles,
  rolPermisos,
  sucursales,
  suscripciones,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import { dentroDeLimite, getPlan, type Plan, type PlanFeatures } from "@/lib/pricing";
import type { SessionUser } from "@/lib/actions/session-helpers";
import {
  puedeAccederModulo,
  tienePermiso,
  type AccessSnapshot,
  type ModuloAcceso,
} from "@/lib/access-control";

export type AccessContext = AccessSnapshot & {
  rolNombre: string | null;
  usuariosExtra: number;
  sucursalesExtra: number;
};

export type RecursoLimitado =
  | "usuarios"
  | "sucursales"
  | "productos"
  | "transacciones_mes"
  | "clientes"
  | "facturas_mes";

const ADMIN_ROLE = "administrador";

export async function getAccessContext(user: SessionUser): Promise<AccessContext> {
  const [usuarioActual] = await db
    .select({
      rolId: usuarios.rolId,
      activo: usuarios.activo,
      esSuperAdmin: usuarios.esSuperAdmin,
    })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.id, user.id),
        eq(usuarios.empresaId, user.empresaId),
        isNull(usuarios.eliminadoEn),
      ),
    )
    .limit(1);

  const rolIdActual = usuarioActual?.rolId ?? user.rolId;
  const usuarioActivo = usuarioActual?.activo ?? true;

  const [rol] = rolIdActual
    ? await db
        .select({ id: roles.id, nombre: roles.nombre })
        .from(roles)
        .where(and(eq(roles.id, rolIdActual), eq(roles.empresaId, user.empresaId)))
        .limit(1)
    : [null];

  const permisosRows = rolIdActual
    ? await db
        .select({ clave: permisos.clave })
        .from(rolPermisos)
        .innerJoin(permisos, eq(permisos.id, rolPermisos.permisoId))
        .where(eq(rolPermisos.rolId, rolIdActual))
    : [];

  const [suscripcion] = await db
    .select({
      planCodigo: planes.codigo,
      planNombre: planes.nombre,
      maxSucursales: planes.maxSucursales,
      maxUsuarios: planes.maxUsuarios,
      maxProductos: planes.maxProductos,
      maxTransaccionesMes: planes.maxTransaccionesMes,
      features: planes.features,
      usuariosExtra: suscripciones.usuariosExtra,
      sucursalesExtra: suscripciones.sucursalesExtra,
    })
    .from(suscripciones)
    .innerJoin(planes, eq(planes.id, suscripciones.planId))
    .where(eq(suscripciones.empresaId, user.empresaId))
    .orderBy(desc(suscripciones.creadoEn))
    .limit(1);

  const plan = normalizarPlan(suscripcion);
  const rolNombre = rol?.nombre ?? null;
  const esAdminEmpresa =
    usuarioActivo &&
    ((usuarioActual?.esSuperAdmin ?? user.esSuperAdmin) ||
      rolNombre?.trim().toLowerCase() === ADMIN_ROLE);

  return {
    esAdminEmpresa,
    permisos: usuarioActivo ? permisosRows.map((p) => p.clave) : [],
    plan,
    rolNombre,
    usuariosExtra: suscripcion?.usuariosExtra ?? 0,
    sucursalesExtra: suscripcion?.sucursalesExtra ?? 0,
  };
}

export async function requireModulo(user: SessionUser, modulo: ModuloAcceso) {
  const access = await getAccessContext(user);
  if (!puedeAccederModulo(access, modulo)) {
    redirect("/dashboard?acceso=denegado");
  }
  return access;
}

export async function validarAccion(
  user: SessionUser,
  opciones: {
    modulo?: ModuloAcceso;
    permisos?: string | string[];
    soloAdmin?: boolean;
  },
): Promise<{ ok: true; access: AccessContext } | { ok: false; error: string }> {
  const access = await getAccessContext(user);

  if (opciones.soloAdmin && !access.esAdminEmpresa) {
    return { ok: false, error: "Solo el administrador puede realizar esta acción." };
  }

  if (opciones.modulo && !puedeAccederModulo(access, opciones.modulo)) {
    return { ok: false, error: "Tu rol o plan no permite acceder a este módulo." };
  }

  if (opciones.permisos && !tienePermiso(access, opciones.permisos)) {
    return { ok: false, error: "No tienes permiso para realizar esta acción." };
  }

  return { ok: true, access };
}

export async function validarLimitePlan(
  access: AccessContext,
  empresaId: string,
  recurso: RecursoLimitado,
  cantidadNueva = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const usado = await contarRecurso(empresaId, recurso);
  const extras =
    recurso === "usuarios"
      ? access.usuariosExtra
      : recurso === "sucursales"
        ? access.sucursalesExtra
        : 0;
  const estado = dentroDeLimite(access.plan, recurso, usado, extras);
  if (estado.limite === null || usado + cantidadNueva <= estado.limite) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `Tu plan ${access.plan.nombre} permite ${estado.limite} ${labelRecurso(
      recurso,
    )}. Ya tienes ${usado}.`,
  };
}

function normalizarPlan(
  row:
    | {
        planCodigo: string;
        planNombre: string;
        maxSucursales: number | null;
        maxUsuarios: number | null;
        maxProductos: number | null;
        maxTransaccionesMes: number | null;
        features: Record<string, boolean>;
      }
    | undefined,
): Plan {
  const base = getPlan(row?.planCodigo ?? "demo");
  return {
    ...base,
    nombre: row?.planNombre ?? base.nombre,
    maxSucursales: row ? row.maxSucursales : base.maxSucursales,
    maxUsuarios: row ? row.maxUsuarios : base.maxUsuarios,
    maxProductos: row ? row.maxProductos : base.maxProductos,
    maxTransaccionesMes: row ? row.maxTransaccionesMes : base.maxTransaccionesMes,
    features: {
      ...base.features,
      ...((row?.features ?? {}) as Partial<PlanFeatures>),
    },
  };
}

async function contarRecurso(
  empresaId: string,
  recurso: RecursoLimitado,
): Promise<number> {
  const [inicioMes, finMes] = rangoMesActual();

  switch (recurso) {
    case "usuarios": {
      const [row] = await db
        .select({ n: count() })
        .from(usuarios)
        .where(
          and(
            eq(usuarios.empresaId, empresaId),
            eq(usuarios.activo, true),
            isNull(usuarios.eliminadoEn),
          ),
        );
      return row?.n ?? 0;
    }
    case "sucursales": {
      const [row] = await db
        .select({ n: count() })
        .from(sucursales)
        .where(
          and(
            eq(sucursales.empresaId, empresaId),
            eq(sucursales.activa, true),
            isNull(sucursales.eliminadoEn),
          ),
        );
      return row?.n ?? 0;
    }
    case "productos": {
      const [row] = await db
        .select({ n: count() })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, empresaId),
            eq(productos.activo, true),
            isNull(productos.eliminadoEn),
          ),
        );
      return row?.n ?? 0;
    }
    case "clientes": {
      const [row] = await db
        .select({ n: count() })
        .from(clientes)
        .where(
          and(
            eq(clientes.empresaId, empresaId),
            eq(clientes.activo, true),
            isNull(clientes.eliminadoEn),
          ),
        );
      return row?.n ?? 0;
    }
    case "transacciones_mes": {
      const [row] = await db
        .select({ n: count() })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, empresaId),
            isNull(ventas.anuladoEn),
            gte(ventas.fecha, inicioMes),
            lt(ventas.fecha, finMes),
          ),
        );
      return row?.n ?? 0;
    }
    case "facturas_mes": {
      const [row] = await db
        .select({ n: count() })
        .from(facturas)
        .where(
          and(
            eq(facturas.empresaId, empresaId),
            gte(facturas.fecha, inicioMes),
            lt(facturas.fecha, finMes),
          ),
        );
      return row?.n ?? 0;
    }
  }
}

function rangoMesActual(): [Date, Date] {
  const ahora = new Date();
  return [
    new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1),
  ];
}

function labelRecurso(recurso: RecursoLimitado): string {
  const labels: Record<RecursoLimitado, string> = {
    usuarios: "usuarios activos",
    sucursales: "sucursales activas",
    productos: "productos activos",
    transacciones_mes: "transacciones por mes",
    clientes: "clientes activos",
    facturas_mes: "facturas por mes",
  };
  return labels[recurso];
}
