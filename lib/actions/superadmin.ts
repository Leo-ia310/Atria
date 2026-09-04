"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { dbSuperAdmin } from "@/lib/db";
import {
  empresas,
  gastosPlataforma,
  pagosSuscripcion,
  planes as planesTable,
  suscripciones,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { asegurarPlanes } from "@/lib/actions/registro";
import { generarNumeroRecibo } from "@/lib/pagos/recibo";
import { getPlan } from "@/lib/pricing";
import { activarSuscripcion, type Ciclo } from "@/lib/suscripciones/core";

export type SuperAdminActionState = {
  ok: boolean;
  mensaje: string;
};

const ESTADO_INICIAL: SuperAdminActionState = { ok: false, mensaje: "" };

const crearGastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.string().trim().min(2).max(80),
  proveedor: z.string().trim().max(120).optional(),
  descripcion: z.string().trim().min(3).max(240),
  monto: z.coerce.number().positive().max(1_000_000),
  moneda: z.enum(["USD", "NIO", "HNL", "GTQ", "CRC", "MXN"]),
  metodoPago: z.string().trim().max(80).optional(),
  recurrente: z.boolean(),
  notas: z.string().trim().max(600).optional(),
});

const activarSchema = z.object({
  empresaId: z.string().uuid(),
  planId: z.enum(["pro", "enterprise"]),
  ciclo: z.enum(["mensual", "anual"]),
  monto: z.coerce.number().positive().max(1_000_000),
  referencia: z.string().trim().max(140).optional(),
  notas: z.string().trim().max(600).optional(),
  confirmarEmpresa: z.string().trim(),
  confirmarAccion: z.string().trim(),
  confirmarCodigo: z.string().trim(),
  confirmoImpacto: z.string().optional(),
});

const accionEmpresaSchema = z.object({
  empresaId: z.string().uuid(),
  motivo: z.string().trim().max(600).optional(),
  confirmarEmpresa: z.string().trim(),
  confirmarAccion: z.string().trim(),
  confirmarCodigo: z.string().trim(),
  confirmoImpacto: z.string().optional(),
});

export async function crearGastoPlataformaAction(
  _prevState: SuperAdminActionState = ESTADO_INICIAL,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await requireSuperAdmin();
  if (!user.ok) return user;

  const parsed = crearGastoSchema.safeParse({
    fecha: formData.get("fecha"),
    categoria: formData.get("categoria"),
    proveedor: formData.get("proveedor"),
    descripcion: formData.get("descripcion"),
    monto: formData.get("monto"),
    moneda: formData.get("moneda") || "USD",
    metodoPago: formData.get("metodoPago"),
    recurrente: formData.get("recurrente") === "on",
    notas: formData.get("notas"),
  });

  if (!parsed.success) {
    return { ok: false, mensaje: "Revisa los datos del gasto." };
  }

  const data = parsed.data;
  await dbSuperAdmin((tx) =>
    tx.insert(gastosPlataforma).values({
      fecha: data.fecha,
      categoria: data.categoria,
      proveedor: vacioANull(data.proveedor),
      descripcion: data.descripcion,
      monto: data.monto.toFixed(4),
      moneda: data.moneda,
      metodoPago: vacioANull(data.metodoPago),
      recurrente: data.recurrente,
      notas: vacioANull(data.notas),
      creadoPorId: user.user.id,
    }),
  );

  revalidarSuperadmin();
  return { ok: true, mensaje: "Gasto de plataforma registrado." };
}

export async function activarMembresiaManualAction(
  _prevState: SuperAdminActionState = ESTADO_INICIAL,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await requireSuperAdmin();
  if (!user.ok) return user;

  const parsed = activarSchema.safeParse({
    empresaId: formData.get("empresaId"),
    planId: formData.get("planId"),
    ciclo: formData.get("ciclo"),
    monto: formData.get("monto"),
    referencia: formData.get("referencia"),
    notas: formData.get("notas"),
    confirmarEmpresa: formData.get("confirmarEmpresa"),
    confirmarAccion: formData.get("confirmarAccion"),
    confirmarCodigo: formData.get("confirmarCodigo"),
    confirmoImpacto: formData.get("confirmoImpacto"),
  });

  if (!parsed.success) {
    return { ok: false, mensaje: "Revisa los datos de activacion." };
  }

  await asegurarPlanes();

  const data = parsed.data;
  const empresa = await buscarEmpresa(data.empresaId);
  if (!empresa) return { ok: false, mensaje: "Empresa no encontrada." };
  const confirmacion = validarConfirmacionEmpresa({
    empresa,
    accion: "ACTIVAR",
    codigo: `PAGO ${codigoCortoEmpresa(empresa.id)}`,
    confirmarEmpresa: data.confirmarEmpresa,
    confirmarAccion: data.confirmarAccion,
    confirmarCodigo: data.confirmarCodigo,
    confirmoImpacto: data.confirmoImpacto,
  });
  if (!confirmacion.ok) return confirmacion;

  const plan = getPlan(data.planId);
  const [planRow] = await dbSuperAdmin((tx) =>
    tx
      .select({ id: planesTable.id })
      .from(planesTable)
      .where(and(eq(planesTable.codigo, data.planId), eq(planesTable.activo, true)))
      .limit(1),
  );
  if (!planRow) return { ok: false, mensaje: "Plan no encontrado o inactivo." };

  const ahora = new Date();
  const ordenId = `transferencia:${empresa.id}:${crypto.randomUUID()}`;
  await dbSuperAdmin(async (tx) => {
    const activada = await activarSuscripcion(tx, {
      empresaId: empresa.id,
      planRowId: planRow.id,
      planId: data.planId,
      ciclo: data.ciclo,
      usuariosExtra: 0,
      sucursalesExtra: 0,
      codigoReferido: null,
      notas: [
        `Activacion manual por transferencia`,
        data.referencia ? `Ref: ${data.referencia}` : null,
        data.notas || null,
      ]
        .filter(Boolean)
        .join(" | "),
      ahora,
    });

    await tx.insert(pagosSuscripcion).values({
      empresaId: empresa.id,
      suscripcionId: activada.suscripcionId,
      numeroRecibo: generarNumeroRecibo(),
      proveedor: "transferencia",
      ordenId,
      capturaId: vacioANull(data.referencia),
      planCodigo: data.planId,
      ciclo: data.ciclo,
      monto: data.monto.toFixed(4),
      moneda: "USD",
      estado: "completado",
      pagadorNombre: empresa.nombreComercial || empresa.razonSocial,
      pagadorEmail: empresa.email,
      completadoEn: ahora,
    });

    await tx
      .update(empresas)
      .set({ activa: true, actualizadoEn: ahora })
      .where(eq(empresas.id, empresa.id));
  });

  revalidarSuperadmin();
  return {
    ok: true,
    mensaje: `Membresia ${plan.nombre} activada para ${empresa.razonSocial}.`,
  };
}

export async function suspenderEmpresaAction(
  _prevState: SuperAdminActionState = ESTADO_INICIAL,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await requireSuperAdmin();
  if (!user.ok) return user;

  const parsed = accionEmpresaSchema.safeParse({
    empresaId: formData.get("empresaId"),
    motivo: formData.get("motivo"),
    confirmarEmpresa: formData.get("confirmarEmpresa"),
    confirmarAccion: formData.get("confirmarAccion"),
    confirmarCodigo: formData.get("confirmarCodigo"),
    confirmoImpacto: formData.get("confirmoImpacto"),
  });
  if (!parsed.success) return { ok: false, mensaje: "Revisa la confirmacion." };

  const data = parsed.data;
  if (data.empresaId === user.user.empresaId) {
    return { ok: false, mensaje: "No puedes suspender la empresa de tu propia sesion." };
  }

  const empresa = await buscarEmpresa(data.empresaId);
  if (!empresa) return { ok: false, mensaje: "Empresa no encontrada." };
  const confirmacion = validarConfirmacionEmpresa({
    empresa,
    accion: "SUSPENDER",
    codigo: `SUSPENDER ${codigoCortoEmpresa(empresa.id)}`,
    confirmarEmpresa: data.confirmarEmpresa,
    confirmarAccion: data.confirmarAccion,
    confirmarCodigo: data.confirmarCodigo,
    confirmoImpacto: data.confirmoImpacto,
  });
  if (!confirmacion.ok) return confirmacion;

  const ahora = new Date();
  await dbSuperAdmin(async (tx) => {
    await tx
      .update(empresas)
      .set({ activa: false, actualizadoEn: ahora })
      .where(eq(empresas.id, empresa.id));
    await tx
      .update(suscripciones)
      .set({
        estado: "suspendida",
        notas: [
          "Suspension manual desde superadmin",
          data.motivo ? `Motivo: ${data.motivo}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      })
      .where(
        and(
          eq(suscripciones.empresaId, empresa.id),
          inArray(suscripciones.estado, ["activa", "trial", "vencida"]),
        ),
      );
  });

  revalidarSuperadmin();
  return { ok: true, mensaje: `${empresa.razonSocial} fue suspendida.` };
}

export async function borrarEmpresaCompletaAction(
  _prevState: SuperAdminActionState = ESTADO_INICIAL,
  formData: FormData,
): Promise<SuperAdminActionState> {
  const user = await requireSuperAdmin();
  if (!user.ok) return user;

  const parsed = accionEmpresaSchema.safeParse({
    empresaId: formData.get("empresaId"),
    motivo: formData.get("motivo"),
    confirmarEmpresa: formData.get("confirmarEmpresa"),
    confirmarAccion: formData.get("confirmarAccion"),
    confirmarCodigo: formData.get("confirmarCodigo"),
    confirmoImpacto: formData.get("confirmoImpacto"),
  });
  if (!parsed.success) return { ok: false, mensaje: "Revisa la confirmacion." };

  const data = parsed.data;
  if (data.empresaId === user.user.empresaId) {
    return { ok: false, mensaje: "No puedes borrar la empresa de tu propia sesion." };
  }

  const empresa = await buscarEmpresa(data.empresaId);
  if (!empresa) return { ok: false, mensaje: "Empresa no encontrada." };
  const confirmacion = validarConfirmacionEmpresa({
    empresa,
    accion: "BORRAR",
    codigo: `BORRAR ${codigoCortoEmpresa(empresa.id)}`,
    confirmarEmpresa: data.confirmarEmpresa,
    confirmarAccion: data.confirmarAccion,
    confirmarCodigo: data.confirmarCodigo,
    confirmoImpacto: data.confirmoImpacto,
  });
  if (!confirmacion.ok) return confirmacion;

  await dbSuperAdmin((tx) => tx.delete(empresas).where(eq(empresas.id, empresa.id)));

  revalidarSuperadmin();
  return {
    ok: true,
    mensaje: `${empresa.razonSocial} y todos sus datos fueron eliminados.`,
  };
}

async function requireSuperAdmin(): Promise<
  | { ok: true; user: Awaited<ReturnType<typeof requireSession>> }
  | { ok: false; mensaje: string }
> {
  const user = await requireSession();
  if (!user.esSuperAdmin) {
    return { ok: false, mensaje: "Solo superadmin puede realizar esta accion." };
  }
  return { ok: true, user };
}

async function buscarEmpresa(empresaId: string) {
  const [empresa] = await dbSuperAdmin((tx) =>
    tx
      .select({
        id: empresas.id,
        razonSocial: empresas.razonSocial,
        nombreComercial: empresas.nombreComercial,
        email: empresas.email,
      })
      .from(empresas)
      .where(eq(empresas.id, empresaId))
      .orderBy(desc(empresas.creadoEn))
      .limit(1),
  );
  return empresa ?? null;
}

function validarConfirmacionEmpresa(input: {
  empresa: { id: string; razonSocial: string };
  accion: "ACTIVAR" | "SUSPENDER" | "BORRAR";
  codigo: string;
  confirmarEmpresa: string;
  confirmarAccion: string;
  confirmarCodigo: string;
  confirmoImpacto?: string;
}): SuperAdminActionState {
  if (normalizar(input.confirmarEmpresa) !== normalizar(input.empresa.razonSocial)) {
    return { ok: false, mensaje: "El nombre de la empresa no coincide." };
  }
  if (input.confirmarAccion.toUpperCase() !== input.accion) {
    return { ok: false, mensaje: `Debes escribir ${input.accion}.` };
  }
  if (input.confirmarCodigo.toUpperCase() !== input.codigo) {
    return { ok: false, mensaje: `El codigo de seguridad debe ser ${input.codigo}.` };
  }
  if (input.confirmoImpacto !== "on") {
    return { ok: false, mensaje: "Confirma que entiendes el impacto de esta accion." };
  }
  return { ok: true, mensaje: "Confirmado." };
}

function codigoCortoEmpresa(empresaId: string): string {
  return empresaId.slice(0, 8).toUpperCase();
}

function normalizar(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLowerCase();
}

function vacioANull(texto?: string | null): string | null {
  const valor = (texto ?? "").trim();
  return valor ? valor : null;
}

function revalidarSuperadmin(): void {
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/tenants");
  revalidatePath("/superadmin/gastos");
}
