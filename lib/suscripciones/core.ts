import "server-only";

import { and, count, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes,
  empresas,
  facturas,
  referidosAtribuciones,
  referidosPagos,
  productos,
  sucursales,
  suscripciones,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import type { TX } from "@/lib/contabilidad/helpers";
import {
  DIAS_TRIAL_PLAN_PAGO,
  DIAS_VIGENCIA_DEMO,
  getPlan,
  type Plan,
  type PlanId,
} from "@/lib/pricing";
import {
  leerCodigoReferidoDesdeCookie,
  normalizarCodigoReferido,
  notificarVentaReferida,
} from "@/lib/referrals/atria-vendedores";

export type Ciclo = "mensual" | "anual";
export type TipoComisionReferido = "primera" | "renovacion";

export function finPeriodo(inicio: Date, planId: PlanId, ciclo: Ciclo): Date {
  const fin = new Date(inicio);
  if (planId === "demo") {
    fin.setDate(fin.getDate() + DIAS_VIGENCIA_DEMO);
  } else if (ciclo === "anual") {
    fin.setFullYear(fin.getFullYear() + 1);
  } else {
    fin.setMonth(fin.getMonth() + 1);
  }
  return fin;
}

export function finTrialPlanPago(inicio: Date): Date {
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + DIAS_TRIAL_PLAN_PAGO);
  return fin;
}

export function rangoMesActual(): [Date, Date] {
  const ahora = new Date();
  return [
    new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1),
  ];
}

/**
 * Cancela la suscripción vigente e inserta la nueva ya activa. Append-only:
 * no borra historial, deja la anterior como "cancelada" y agrega una fila nueva.
 * Debe correr dentro de una transacción.
 */
export async function activarSuscripcion(
  tx: TX,
  params: {
    empresaId: string;
    planRowId: string;
    planId: PlanId;
    ciclo: Ciclo;
    usuariosExtra: number;
    sucursalesExtra: number;
    codigoReferido: string | null;
    notas: string;
    ahora?: Date;
  },
): Promise<{ suscripcionId: string; inicio: Date; fin: Date }> {
  const inicio = params.ahora ?? new Date();
  const fin = finPeriodo(inicio, params.planId, params.ciclo);

  await tx
    .update(suscripciones)
    .set({ estado: "cancelada", canceladaEn: inicio })
    .where(
      and(
        eq(suscripciones.empresaId, params.empresaId),
        inArray(suscripciones.estado, ["activa", "trial", "suspendida"]),
      ),
    );

  const [nueva] = await tx
    .insert(suscripciones)
    .values({
      empresaId: params.empresaId,
      planId: params.planRowId,
      estado: params.planId === "demo" ? "trial" : "activa",
      ciclo: params.ciclo,
      usuariosExtra: params.usuariosExtra,
      sucursalesExtra: params.sucursalesExtra,
      codigoReferido: params.codigoReferido,
      inicioPeriodo: inicio,
      finPeriodo: fin,
      notas: params.notas,
    })
    .returning({ id: suscripciones.id });

  return { suscripcionId: nueva.id, inicio, fin };
}

/**
 * Verifica que el uso actual de la empresa cabe en los límites del plan destino.
 * Evita cobrar/activar un plan al que la empresa no puede bajar sin perder datos.
 */
export async function validarUsoActual(
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
    limite("sucursales activas", usados.sucursales, plan.maxSucursales, extras.sucursales),
    limite("productos activos", usados.productos, plan.maxProductos),
    limite("clientes activos", usados.clientes, plan.maxClientes),
    limite("ventas del mes", usados.ventasMes, plan.maxTransaccionesMes),
    limite("facturas del mes", usados.facturasMes, plan.maxFacturasMes),
  ];
  const bloqueado = checks.find((check) => check);

  if (bloqueado) {
    return { ok: false, error: `No puedes cambiar a ${plan.nombre}: ${bloqueado}.` };
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

export async function resolverCodigoReferido(
  empresaId: string,
  codigoReferidoCliente?: string | null,
): Promise<string | null> {
  const [atribucion] = await db
    .select({ codigoReferido: referidosAtribuciones.codigoReferido })
    .from(referidosAtribuciones)
    .where(eq(referidosAtribuciones.empresaId, empresaId))
    .limit(1);

  const permanente = normalizarCodigoReferido(atribucion?.codigoReferido);
  if (permanente) return permanente;

  const [empresa] = await db
    .select({ codigoReferido: empresas.codigoReferido })
    .from(empresas)
    .where(eq(empresas.id, empresaId))
    .limit(1);

  const existente = normalizarCodigoReferido(empresa?.codigoReferido);
  const capturado =
    normalizarCodigoReferido(codigoReferidoCliente) ||
    normalizarCodigoReferido(await leerCodigoReferidoDesdeCookie());

  if (!capturado) return existente || null;

  if (capturado !== existente) {
    await db
      .update(empresas)
      .set({ codigoReferido: capturado, referidoCapturadoEn: new Date() })
      .where(eq(empresas.id, empresaId));
  }

  return capturado;
}

export function referenciaExternaPagoReferido(input: {
  empresaId: string;
  planId: PlanId;
  ciclo: Ciclo;
  fecha: Date;
  pagoSuscripcionId: string;
}): string {
  return `plan:${input.empresaId}:${input.planId}:${input.ciclo}:${input.fecha
    .toISOString()
    .slice(0, 10)}:pago:${input.pagoSuscripcionId}`;
}

export async function registrarPagoReferido(
  tx: TX,
  params: {
    empresaId: string;
    pagoSuscripcionId: string;
    codigoReferido: string;
    planId: PlanId;
    ciclo: Ciclo;
    monto: number;
    tipoComision: TipoComisionReferido;
    fecha: Date;
    origen: string;
  },
): Promise<{ referenciaExterna: string; tipoComision: TipoComisionReferido }> {
  const codigoReferido = normalizarCodigoReferido(params.codigoReferido);
  const referenciaExterna = referenciaExternaPagoReferido({
    empresaId: params.empresaId,
    planId: params.planId,
    ciclo: params.ciclo,
    fecha: params.fecha,
    pagoSuscripcionId: params.pagoSuscripcionId,
  });

  await tx
    .insert(referidosAtribuciones)
    .values({
      empresaId: params.empresaId,
      codigoReferido,
      primerPagoId: params.pagoSuscripcionId,
      origen: params.origen,
      metadata: { lockedBy: "first_referred_payment" },
      fijadoEn: params.fecha,
      actualizadoEn: params.fecha,
    })
    .onConflictDoNothing({ target: referidosAtribuciones.empresaId });

  await tx
    .update(empresas)
    .set({
      codigoReferido,
      referidoCapturadoEn: params.fecha,
    })
    .where(eq(empresas.id, params.empresaId));

  await tx
    .insert(referidosPagos)
    .values({
      empresaId: params.empresaId,
      pagoSuscripcionId: params.pagoSuscripcionId,
      codigoReferido,
      planCodigo: params.planId,
      ciclo: params.ciclo,
      monto: params.monto.toFixed(4),
      tipoComision: params.tipoComision,
      referenciaExterna,
      estadoNotificacion: "pendiente",
      creadoEn: params.fecha,
      actualizadoEn: params.fecha,
    })
    .onConflictDoUpdate({
      target: referidosPagos.pagoSuscripcionId,
      set: {
        codigoReferido,
        planCodigo: params.planId,
        ciclo: params.ciclo,
        monto: params.monto.toFixed(4),
        tipoComision: params.tipoComision,
        referenciaExterna,
        estadoNotificacion: "pendiente",
        errorNotificacion: null,
        actualizadoEn: params.fecha,
      },
    });

  return { referenciaExterna, tipoComision: params.tipoComision };
}

export async function notificarCambioReferido(input: {
  pagoSuscripcionId: string;
  empresaId: string;
  codigoReferido: string;
  planId: PlanId;
  ciclo: Ciclo;
  monto: number;
  cliente: string;
  clienteEmail: string;
  clienteTelefono?: string | null;
  empresaCliente: string;
  empresaTelefono?: string | null;
  empresaPais?: string | null;
  tipoEmpresa?: string | null;
  tipoComision: TipoComisionReferido;
  referenciaExterna: string;
  fecha: Date;
}): Promise<void> {
  const plan = getPlan(input.planId);
  const resultado = await notificarVentaReferida({
    codigoReferido: input.codigoReferido,
    referenciaExterna: input.referenciaExterna,
    cliente: input.cliente,
    clienteEmail: input.clienteEmail,
    clienteTelefono: input.clienteTelefono,
    empresaCliente: input.empresaCliente,
    empresaTelefono: input.empresaTelefono,
    empresaPais: input.empresaPais,
    tipoEmpresa: input.tipoEmpresa,
    plan: `${plan.nombre} ${input.ciclo}`,
    monto: input.monto,
    tipoVenta: input.tipoComision,
    origen: "pago_paypal",
    fechaVenta: input.fecha,
  });

  if (resultado.ok) {
    await db
      .update(referidosPagos)
      .set({
        estadoNotificacion: "enviado",
        notificadoEn: new Date(),
        errorNotificacion: null,
        actualizadoEn: new Date(),
      })
      .where(eq(referidosPagos.pagoSuscripcionId, input.pagoSuscripcionId));
    return;
  }

  await db
    .update(referidosPagos)
    .set({
      estadoNotificacion: "fallido",
      errorNotificacion: [resultado.code, resultado.error].filter(Boolean).join(": ").slice(0, 1000),
      actualizadoEn: new Date(),
    })
    .where(eq(referidosPagos.pagoSuscripcionId, input.pagoSuscripcionId));
}
