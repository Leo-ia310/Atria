"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  facturas,
  planes as planesTable,
  productos,
  sucursales,
  suscripciones,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { asegurarPlanes } from "@/lib/actions/registro";
import { validarAccion } from "@/lib/server-access";
import { getPlan, type Plan, type PlanId } from "@/lib/pricing";

type Ciclo = "mensual" | "anual";

type Resultado =
  | { ok: true; plan: string }
  | { ok: false; error: string };

const PLAN_IDS = new Set<PlanId>(["demo", "pro", "enterprise"]);

export async function cambiarPlan(
  planId: PlanId,
  ciclo: Ciclo = "mensual",
): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  if (!PLAN_IDS.has(planId)) {
    return { ok: false, error: "Plan no valido." };
  }

  const cicloNormalizado: Ciclo = planId === "demo" ? "mensual" : ciclo;
  const plan = getPlan(planId);

  await asegurarPlanes();

  const [planRow] = await db
    .select({ id: planesTable.id, codigo: planesTable.codigo, nombre: planesTable.nombre })
    .from(planesTable)
    .where(and(eq(planesTable.codigo, planId), eq(planesTable.activo, true)))
    .limit(1);

  if (!planRow) {
    return { ok: false, error: "No encontramos ese plan activo." };
  }

  const [actual] = await db
    .select({
      id: suscripciones.id,
      planId: suscripciones.planId,
      ciclo: suscripciones.ciclo,
      usuariosExtra: suscripciones.usuariosExtra,
      sucursalesExtra: suscripciones.sucursalesExtra,
      planCodigo: planesTable.codigo,
    })
    .from(suscripciones)
    .innerJoin(planesTable, eq(planesTable.id, suscripciones.planId))
    .where(eq(suscripciones.empresaId, user.empresaId))
    .orderBy(desc(suscripciones.creadoEn))
    .limit(1);

  if (actual?.planCodigo === planId && actual.ciclo === cicloNormalizado) {
    return { ok: true, plan: plan.nombre };
  }

  const extras = {
    usuarios:
      plan.precioUsuarioExtra === null ? 0 : (actual?.usuariosExtra ?? 0),
    sucursales:
      plan.precioSucursalExtra === null ? 0 : (actual?.sucursalesExtra ?? 0),
  };

  const limite = await validarUsoActual(user.empresaId, plan, extras);
  if (!limite.ok) return limite;

  const ahora = new Date();
  const fin = finPeriodo(ahora, planId, cicloNormalizado);

  await db.transaction(async (tx) => {
    await tx
      .update(suscripciones)
      .set({ estado: "cancelada", canceladaEn: ahora })
      .where(
        and(
          eq(suscripciones.empresaId, user.empresaId),
          inArray(suscripciones.estado, ["activa", "trial", "suspendida"]),
        ),
      );

    await tx.insert(suscripciones).values({
      empresaId: user.empresaId,
      planId: planRow.id,
      estado: planId === "demo" ? "trial" : "activa",
      ciclo: cicloNormalizado,
      usuariosExtra: extras.usuarios,
      sucursalesExtra: extras.sucursales,
      inicioPeriodo: ahora,
      finPeriodo: fin,
      notas: `Cambio de plan a ${plan.nombre}`,
    });
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
  return { ok: true, plan: plan.nombre };
}

async function validarUsoActual(
  empresaId: string,
  plan: Plan,
  extras: { usuarios: number; sucursales: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [inicioMes, finMes] = rangoMesActual();
  const [
    usuariosActivos,
    sucursalesActivas,
    productosActivos,
    clientesActivos,
    ventasMes,
    facturasMes,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(usuarios)
      .where(
        and(
          eq(usuarios.empresaId, empresaId),
          eq(usuarios.activo, true),
          isNull(usuarios.eliminadoEn),
        ),
      ),
    db
      .select({ n: count() })
      .from(sucursales)
      .where(
        and(
          eq(sucursales.empresaId, empresaId),
          eq(sucursales.activa, true),
          isNull(sucursales.eliminadoEn),
        ),
      ),
    db
      .select({ n: count() })
      .from(productos)
      .where(
        and(
          eq(productos.empresaId, empresaId),
          eq(productos.activo, true),
          isNull(productos.eliminadoEn),
        ),
      ),
    db
      .select({ n: count() })
      .from(clientes)
      .where(
        and(
          eq(clientes.empresaId, empresaId),
          eq(clientes.activo, true),
          isNull(clientes.eliminadoEn),
        ),
      ),
    db
      .select({ n: count() })
      .from(ventas)
      .where(
        and(
          eq(ventas.empresaId, empresaId),
          isNull(ventas.anuladoEn),
          gte(ventas.fecha, inicioMes),
          lt(ventas.fecha, finMes),
        ),
      ),
    db
      .select({ n: count() })
      .from(facturas)
      .where(
        and(
          eq(facturas.empresaId, empresaId),
          gte(facturas.fecha, inicioMes),
          lt(facturas.fecha, finMes),
        ),
      ),
  ]);

  const usados = {
    usuarios: usuariosActivos[0]?.n ?? 0,
    sucursales: sucursalesActivas[0]?.n ?? 0,
    productos: productosActivos[0]?.n ?? 0,
    clientes: clientesActivos[0]?.n ?? 0,
    ventasMes: ventasMes[0]?.n ?? 0,
    facturasMes: facturasMes[0]?.n ?? 0,
  };

  const checks = [
    limite("usuarios activos", usados.usuarios, plan.maxUsuarios, extras.usuarios),
    limite(
      "sucursales activas",
      usados.sucursales,
      plan.maxSucursales,
      extras.sucursales,
    ),
    limite("productos activos", usados.productos, plan.maxProductos),
    limite("clientes activos", usados.clientes, plan.maxClientes),
    limite("ventas del mes", usados.ventasMes, plan.maxTransaccionesMes),
    limite("facturas del mes", usados.facturasMes, plan.maxFacturasMes),
  ];
  const bloqueado = checks.find((check) => check);

  if (bloqueado) {
    return {
      ok: false,
      error: `No puedes cambiar a ${plan.nombre}: ${bloqueado}.`,
    };
  }

  return { ok: true };
}

function limite(
  label: string,
  usado: number,
  base: number | null,
  extras = 0,
): string | null {
  if (base === null) return null;
  const permitido = base + extras;
  return usado <= permitido ? null : `tienes ${usado} ${label} y el limite es ${permitido}`;
}

function finPeriodo(inicio: Date, planId: PlanId, ciclo: Ciclo) {
  const fin = new Date(inicio);
  if (planId === "demo") {
    fin.setDate(fin.getDate() + 14);
  } else if (ciclo === "anual") {
    fin.setFullYear(fin.getFullYear() + 1);
  } else {
    fin.setMonth(fin.getMonth() + 1);
  }
  return fin;
}

function rangoMesActual(): [Date, Date] {
  const ahora = new Date();
  return [
    new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1),
  ];
}
