"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  pagosSuscripcion,
  planes as planesTable,
  suscripciones,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { asegurarPlanes } from "@/lib/actions/registro";
import { validarAccion } from "@/lib/server-access";
import { getPlan, type PlanId } from "@/lib/pricing";
import {
  activarSuscripcion,
  notificarCambioReferido,
  resolverCodigoReferido,
  validarUsoActual,
  type Ciclo,
} from "@/lib/suscripciones/core";
import {
  capturarOrden,
  crearOrden,
  PayPalError,
  paypalConfigurado,
} from "@/lib/pagos/paypal";
import {
  generarNumeroRecibo,
  type ReciboData,
} from "@/lib/pagos/recibo";
import { enviarEmail } from "@/lib/email/resend";
import { reciboPagoHtml, reciboPagoTexto } from "@/lib/email/templates/recibo-pago";
import { alertaPagoHtml, alertaPagoTexto } from "@/lib/email/templates/alerta-pago";
import { withLock } from "@/lib/redis/lock";

const PLANES_PAGADOS = new Set<PlanId>(["pro", "enterprise"]);
const MONEDA = "USD";

type ResultadoOrden =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

type ResultadoCaptura =
  | { ok: true; recibo: ReciboData }
  | { ok: false; error: string };

function precioPlan(planId: PlanId, ciclo: Ciclo): number {
  const plan = getPlan(planId);
  return ciclo === "anual" ? plan.precioAnual : plan.precioMensual;
}

export async function crearOrdenPlan(
  planId: PlanId,
  ciclo: Ciclo = "mensual",
): Promise<ResultadoOrden> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  if (!PLANES_PAGADOS.has(planId)) {
    return { ok: false, error: "Ese plan no requiere pago." };
  }
  if (!paypalConfigurado()) {
    return { ok: false, error: "Los pagos no están configurados." };
  }

  const plan = getPlan(planId);

  const limite = await validarUsoActual(user.empresaId, plan, {
    usuarios: 0,
    sucursales: 0,
  });
  if (!limite.ok) return limite;

  const monto = precioPlan(planId, ciclo);
  const montoStr = monto.toFixed(2);

  try {
    await asegurarPlanes();

    const orden = await crearOrden({
      monto: montoStr,
      moneda: MONEDA,
      descripcion: `ARCA — Plan ${plan.nombre} (${ciclo})`,
      referencia: user.empresaId,
      customId: `${user.empresaId}:${planId}:${ciclo}`,
    });

    await db.insert(pagosSuscripcion).values({
      empresaId: user.empresaId,
      numeroRecibo: generarNumeroRecibo(),
      proveedor: "paypal",
      ordenId: orden.id,
      planCodigo: planId,
      ciclo,
      monto: montoStr,
      moneda: MONEDA,
      estado: "creado",
    });

    return { ok: true, orderId: orden.id };
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error("[pagos] crearOrden falló.", error, error.detalle);
      return { ok: false, error: "No se pudo iniciar el pago con PayPal." };
    }
    console.error("[pagos] crearOrden error inesperado.", error);
    return { ok: false, error: "Error inesperado iniciando el pago." };
  }
}

export async function capturarOrdenPlan(orderId: string): Promise<ResultadoCaptura> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { soloAdmin: true });
  if (!acceso.ok) return acceso;

  const ordenLimpia = String(orderId || "").trim();
  if (!ordenLimpia) return { ok: false, error: "Orden inválida." };

  const [pago] = await db
    .select()
    .from(pagosSuscripcion)
    .where(
      and(
        eq(pagosSuscripcion.ordenId, ordenLimpia),
        eq(pagosSuscripcion.empresaId, user.empresaId),
      ),
    )
    .limit(1);

  if (!pago) return { ok: false, error: "No encontramos esa orden." };

  // Idempotencia: si ya se completó, devolvemos el mismo recibo sin volver a cobrar.
  if (pago.estado === "completado") {
    const recibo = await reconstruirRecibo(pago.id, user.empresaId);
    return recibo
      ? { ok: true, recibo }
      : { ok: false, error: "El pago ya fue procesado." };
  }

  const resultado = await withLock(
    `pago:capture:${ordenLimpia}`,
    () => procesarCaptura(ordenLimpia, user.empresaId, {
      nombre: user.nombre,
      email: user.email,
    }),
    120,
  );

  if (resultado === null) {
    return { ok: false, error: "El pago se está procesando, espera un momento." };
  }
  return resultado;
}

async function procesarCaptura(
  ordenId: string,
  empresaId: string,
  usuario: { nombre: string; email: string },
): Promise<ResultadoCaptura> {
  const [pago] = await db
    .select()
    .from(pagosSuscripcion)
    .where(
      and(
        eq(pagosSuscripcion.ordenId, ordenId),
        eq(pagosSuscripcion.empresaId, empresaId),
      ),
    )
    .limit(1);

  if (!pago) return { ok: false, error: "No encontramos esa orden." };
  if (pago.estado === "completado") {
    const recibo = await reconstruirRecibo(pago.id, empresaId);
    return recibo
      ? { ok: true, recibo }
      : { ok: false, error: "El pago ya fue procesado." };
  }

  const planId = pago.planCodigo as PlanId;
  const plan = getPlan(planId);

  const [empresa] = await db
    .select({
      razonSocial: empresas.razonSocial,
      nombreComercial: empresas.nombreComercial,
      email: empresas.email,
      codigoReferido: empresas.codigoReferido,
    })
    .from(empresas)
    .where(eq(empresas.id, empresaId))
    .limit(1);

  const [planRow] = await db
    .select({ id: planesTable.id })
    .from(planesTable)
    .where(and(eq(planesTable.codigo, planId), eq(planesTable.activo, true)))
    .limit(1);

  if (!planRow) return { ok: false, error: "No encontramos ese plan activo." };

  let captura;
  try {
    captura = await capturarOrden(ordenId);
  } catch (error) {
    await marcarFallido(pago.id);
    if (error instanceof PayPalError) {
      console.error("[pagos] captura falló.", error, error.detalle);
      return { ok: false, error: "PayPal no pudo confirmar el pago." };
    }
    console.error("[pagos] captura error inesperado.", error);
    return { ok: false, error: "Error inesperado confirmando el pago." };
  }

  if (captura.status !== "COMPLETED") {
    await marcarFallido(pago.id);
    return { ok: false, error: "El pago no se completó en PayPal." };
  }

  const montoEsperado = Number(pago.monto);
  const montoPagado = Number(captura.monto ?? "0");
  if (!Number.isFinite(montoPagado) || Math.abs(montoPagado - montoEsperado) > 0.01) {
    await marcarFallido(pago.id);
    console.error(
      `[pagos] Monto no coincide. esperado=${montoEsperado} pagado=${montoPagado} orden=${ordenId}`,
    );
    return { ok: false, error: "El monto del pago no coincide." };
  }

  const empresaNombre = empresa?.nombreComercial || empresa?.razonSocial || "Tu empresa";
  const ahora = new Date();
  const codigoReferido = await resolverCodigoReferido(empresaId);
  const esPrimera = await esPrimerPagoCompletado(empresaId);

  const { fin } = await db.transaction(async (tx) => {
    const activada = await activarSuscripcion(tx, {
      empresaId,
      planRowId: planRow.id,
      planId,
      ciclo: pago.ciclo,
      usuariosExtra: 0,
      sucursalesExtra: 0,
      codigoReferido,
      notas: `Pago PayPal ${captura.capturaId ?? ordenId}`,
      ahora,
    });

    await tx
      .update(pagosSuscripcion)
      .set({
        estado: "completado",
        capturaId: captura.capturaId,
        pagadorEmail: captura.pagadorEmail,
        pagadorNombre: captura.pagadorNombre,
        suscripcionId: activada.suscripcionId,
        completadoEn: ahora,
      })
      .where(eq(pagosSuscripcion.id, pago.id));

    return activada;
  });

  const recibo: ReciboData = {
    numeroRecibo: pago.numeroRecibo,
    fechaISO: ahora.toISOString(),
    empresaNombre,
    planNombre: plan.nombre,
    ciclo: pago.ciclo,
    monto: montoEsperado,
    moneda: pago.moneda,
    metodoPago: "PayPal",
    pagadorNombre: captura.pagadorNombre,
    pagadorEmail: captura.pagadorEmail,
    ordenId,
    vigenteHastaISO: fin.toISOString(),
  };

  const destino = empresa?.email || usuario.email;
  if (destino) {
    const envio = await enviarEmail({
      para: destino,
      asunto: `Factura ${recibo.numeroRecibo} — Plan ${plan.nombre} activado`,
      html: reciboPagoHtml(recibo),
      texto: reciboPagoTexto(recibo),
    });
    if (envio.ok) {
      await db
        .update(pagosSuscripcion)
        .set({ reciboEnviadoA: destino, reciboEnviadoEn: new Date() })
        .where(eq(pagosSuscripcion.id, pago.id));
    }
  }

  const alertaEmail = process.env.BILLING_ALERT_EMAIL;
  if (alertaEmail) {
    await enviarEmail({
      para: alertaEmail,
      asunto: `Nuevo pago — ${plan.nombre} ${recibo.ciclo} (${empresaNombre})`,
      html: alertaPagoHtml(recibo),
      texto: alertaPagoTexto(recibo),
    }).catch((error) => console.warn("[pagos] alerta de pago falló.", error));
  }

  if (codigoReferido) {
    await notificarCambioReferido({
      empresaId,
      codigoReferido,
      planId,
      ciclo: pago.ciclo,
      cliente: usuario.nombre,
      clienteEmail: usuario.email,
      empresaCliente: empresaNombre,
      esPrimera,
      fecha: ahora,
    }).catch((error) => console.warn("[pagos] notificación de referido falló.", error));
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion");

  return { ok: true, recibo };
}

async function marcarFallido(pagoId: string): Promise<void> {
  await db
    .update(pagosSuscripcion)
    .set({ estado: "fallido" })
    .where(eq(pagosSuscripcion.id, pagoId));
}

async function esPrimerPagoCompletado(empresaId: string): Promise<boolean> {
  const [previo] = await db
    .select({ id: pagosSuscripcion.id })
    .from(pagosSuscripcion)
    .where(
      and(
        eq(pagosSuscripcion.empresaId, empresaId),
        eq(pagosSuscripcion.estado, "completado"),
      ),
    )
    .limit(1);
  return !previo;
}

async function reconstruirRecibo(
  pagoId: string,
  empresaId: string,
): Promise<ReciboData | null> {
  const [row] = await db
    .select({
      pago: pagosSuscripcion,
      empresaRazon: empresas.razonSocial,
      empresaComercial: empresas.nombreComercial,
      finPeriodo: suscripciones.finPeriodo,
    })
    .from(pagosSuscripcion)
    .innerJoin(empresas, eq(empresas.id, pagosSuscripcion.empresaId))
    .leftJoin(suscripciones, eq(suscripciones.id, pagosSuscripcion.suscripcionId))
    .where(
      and(eq(pagosSuscripcion.id, pagoId), eq(pagosSuscripcion.empresaId, empresaId)),
    )
    .limit(1);

  if (!row) return null;
  const { pago } = row;
  const plan = getPlan(pago.planCodigo as PlanId);

  return {
    numeroRecibo: pago.numeroRecibo,
    fechaISO: (pago.completadoEn ?? pago.creadoEn).toISOString(),
    empresaNombre: row.empresaComercial || row.empresaRazon || "Tu empresa",
    planNombre: plan.nombre,
    ciclo: pago.ciclo,
    monto: Number(pago.monto),
    moneda: pago.moneda,
    metodoPago: "PayPal",
    pagadorNombre: pago.pagadorNombre,
    pagadorEmail: pago.pagadorEmail,
    ordenId: pago.ordenId,
    vigenteHastaISO: (row.finPeriodo ?? pago.creadoEn).toISOString(),
  };
}
