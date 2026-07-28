"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  empleados,
  asistencias,
  feriados,
  nominas,
  nominaDetalles,
  solicitudesRrhh,
  vacantes,
  candidatos,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import {
  empleadoSchema,
  asistenciaSchema,
  solicitudSchema,
  feriadoSchema,
  nominaGenerarSchema,
  vacanteSchema,
  candidatoSchema,
} from "@/lib/validations/rrhh";
import {
  registrarNominaDevengo,
  registrarPagoNomina,
} from "@/lib/contabilidad/motor-asientos";
import {
  FERIADOS_POR_PAIS,
  TASA_SEGURIDAD_SOCIAL,
  factorPeriodo,
  diasDelPeriodo,
} from "@/lib/rrhh";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";

type Resultado = { ok: true; id: string } | { ok: false; error: string };
type ResultadoSimple = { ok: true } | { ok: false; error: string };

function dec(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}
function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isNaN(n) ? 0 : n;
}
function fechaMediodia(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function correlativo(ultimo: string | undefined, prefijo: string): string {
  const n = ultimo ? parseInt(ultimo.split("-").pop() ?? "0", 10) + 1 : 1;
  return `${prefijo}-${String(n).padStart(4, "0")}`;
}

async function siguienteCodigoEmpleado(empresaId: string): Promise<string> {
  const [fila] = await db
    .select({ codigo: empleados.codigo })
    .from(empleados)
    .where(and(eq(empleados.empresaId, empresaId), sql`${empleados.codigo} like 'EMP-%'`))
    .orderBy(desc(empleados.codigo))
    .limit(1);
  return correlativo(fila?.codigo, "EMP");
}

async function siguienteCodigoVacante(empresaId: string): Promise<string> {
  const [fila] = await db
    .select({ codigo: vacantes.codigo })
    .from(vacantes)
    .where(and(eq(vacantes.empresaId, empresaId), sql`${vacantes.codigo} like 'VAC-%'`))
    .orderBy(desc(vacantes.codigo))
    .limit(1);
  return correlativo(fila?.codigo, "VAC");
}

/* ============================ EMPLEADOS ============================ */

export async function crearEmpleado(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = empleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const codigo = await siguienteCodigoEmpleado(user.empresaId);
    const [creado] = await db
      .insert(empleados)
      .values({
        empresaId: user.empresaId,
        codigo,
        sucursalId: d.sucursalId || null,
        nombres: d.nombres,
        apellidos: d.apellidos,
        identificacion: d.identificacion || null,
        email: d.email || null,
        telefono: d.telefono || null,
        direccion: d.direccion || null,
        fechaNacimiento: d.fechaNacimiento || null,
        genero: d.genero || null,
        puesto: d.puesto,
        departamento: d.departamento || null,
        tipoContrato: d.tipoContrato,
        fechaIngreso: d.fechaIngreso,
        salarioBase: dec(d.salarioBase),
        frecuenciaPago: d.frecuenciaPago,
        diasVacacionesAnuales: d.diasVacacionesAnuales,
        banco: d.banco || null,
        cuentaBanco: d.cuentaBanco || null,
        contactoEmergenciaNombre: d.contactoEmergenciaNombre || null,
        contactoEmergenciaTelefono: d.contactoEmergenciaTelefono || null,
        notas: d.notas || null,
        estado: "activo",
      })
      .returning({ id: empleados.id });
    revalidatePath("/rrhh/empleados");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearEmpleado]", err);
    return { ok: false, error: "No pudimos crear el empleado." };
  }
}

export async function actualizarEmpleado(id: string, input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = empleadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    await db
      .update(empleados)
      .set({
        sucursalId: d.sucursalId || null,
        nombres: d.nombres,
        apellidos: d.apellidos,
        identificacion: d.identificacion || null,
        email: d.email || null,
        telefono: d.telefono || null,
        direccion: d.direccion || null,
        fechaNacimiento: d.fechaNacimiento || null,
        genero: d.genero || null,
        puesto: d.puesto,
        departamento: d.departamento || null,
        tipoContrato: d.tipoContrato,
        fechaIngreso: d.fechaIngreso,
        salarioBase: dec(d.salarioBase),
        frecuenciaPago: d.frecuenciaPago,
        diasVacacionesAnuales: d.diasVacacionesAnuales,
        banco: d.banco || null,
        cuentaBanco: d.cuentaBanco || null,
        contactoEmergenciaNombre: d.contactoEmergenciaNombre || null,
        contactoEmergenciaTelefono: d.contactoEmergenciaTelefono || null,
        notas: d.notas || null,
        actualizadoEn: new Date(),
      })
      .where(and(eq(empleados.id, id), eq(empleados.empresaId, user.empresaId)));
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarEmpleado]", err);
    return { ok: false, error: "No pudimos actualizar el empleado." };
  }
}

export async function cambiarEstadoEmpleado(
  id: string,
  estado: "activo" | "vacaciones" | "licencia" | "suspendido" | "baja",
): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    await db
      .update(empleados)
      .set({
        estado,
        fechaSalida: estado === "baja" ? new Date().toISOString().slice(0, 10) : null,
        actualizadoEn: new Date(),
      })
      .where(and(eq(empleados.id, id), eq(empleados.empresaId, user.empresaId)));
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${id}`);
    return { ok: true };
  } catch (err) {
    console.error("[cambiarEstadoEmpleado]", err);
    return { ok: false, error: "No pudimos cambiar el estado." };
  }
}

/* ============================ ASISTENCIA ============================ */

export async function registrarAsistencia(input: unknown): Promise<ResultadoSimple> {
  const user = await requireSession();
  const parsed = asistenciaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [emp] = await db
      .select({ id: empleados.id })
      .from(empleados)
      .where(and(eq(empleados.id, d.empleadoId), eq(empleados.empresaId, user.empresaId)))
      .limit(1);
    if (!emp) return { ok: false, error: "Empleado no encontrado." };

    await db
      .insert(asistencias)
      .values({
        empresaId: user.empresaId,
        empleadoId: d.empleadoId,
        fecha: d.fecha,
        estado: d.estado,
        horasTrabajadas: dec(d.horasTrabajadas),
        horasExtra: dec(d.horasExtra),
        notas: d.notas || null,
        registradoPor: user.id,
      })
      .onConflictDoUpdate({
        target: [asistencias.empleadoId, asistencias.fecha],
        set: {
          estado: d.estado,
          horasTrabajadas: dec(d.horasTrabajadas),
          horasExtra: dec(d.horasExtra),
          notas: d.notas || null,
          registradoPor: user.id,
        },
      });
    revalidatePath("/rrhh/asistencia");
    return { ok: true };
  } catch (err) {
    console.error("[registrarAsistencia]", err);
    return { ok: false, error: "No pudimos registrar la asistencia." };
  }
}

/* ============================ FERIADOS ============================ */

export async function crearFeriado(input: unknown): Promise<ResultadoSimple> {
  const user = await requireSession();
  const parsed = feriadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    await db
      .insert(feriados)
      .values({
        empresaId: user.empresaId,
        nombre: d.nombre,
        fecha: d.fecha,
        esNacional: d.esNacional,
        esRecurrente: d.esRecurrente,
      })
      .onConflictDoNothing();
    revalidatePath("/rrhh/nomina");
    revalidatePath("/rrhh/feriados");
    return { ok: true };
  } catch (err) {
    console.error("[crearFeriado]", err);
    return { ok: false, error: "No pudimos crear el feriado." };
  }
}

export async function eliminarFeriado(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    await db
      .delete(feriados)
      .where(and(eq(feriados.id, id), eq(feriados.empresaId, user.empresaId)));
    revalidatePath("/rrhh/nomina");
    revalidatePath("/rrhh/feriados");
    return { ok: true };
  } catch (err) {
    console.error("[eliminarFeriado]", err);
    return { ok: false, error: "No pudimos eliminar el feriado." };
  }
}

export async function sembrarFeriados(anio: number): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    const [empresa] = await db
      .select({ pais: empresas.pais })
      .from(empresas)
      .where(eq(empresas.id, user.empresaId))
      .limit(1);
    const pais = (empresa?.pais ?? "NI") as PaisCodigo;
    const base = FERIADOS_POR_PAIS[pais] ?? [];
    const filas = base.map((f) => ({
      empresaId: user.empresaId,
      nombre: f.nombre,
      fecha: `${anio}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`,
      esNacional: true,
      esRecurrente: true,
    }));
    if (filas.length > 0) {
      await db.insert(feriados).values(filas).onConflictDoNothing();
    }
    revalidatePath("/rrhh/nomina");
    revalidatePath("/rrhh/feriados");
    return { ok: true };
  } catch (err) {
    console.error("[sembrarFeriados]", err);
    return { ok: false, error: "No pudimos cargar los feriados." };
  }
}

/* ============================ SOLICITUDES ============================ */

function contarDias(inicio?: string, fin?: string): number {
  if (!inicio) return 0;
  const a = fechaMediodia(inicio).getTime();
  const b = fin ? fechaMediodia(fin).getTime() : a;
  const dias = Math.round((b - a) / 86400000) + 1;
  return dias > 0 ? dias : 1;
}

export async function crearSolicitud(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = solicitudSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [emp] = await db
      .select({ id: empleados.id })
      .from(empleados)
      .where(and(eq(empleados.id, d.empleadoId), eq(empleados.empresaId, user.empresaId)))
      .limit(1);
    if (!emp) return { ok: false, error: "Empleado no encontrado." };

    const dias = contarDias(d.fechaInicio || undefined, d.fechaFin || undefined);
    const [creada] = await db
      .insert(solicitudesRrhh)
      .values({
        empresaId: user.empresaId,
        empleadoId: d.empleadoId,
        tipo: d.tipo,
        estado: "pendiente",
        fechaInicio: d.fechaInicio || null,
        fechaFin: d.fechaFin || null,
        dias: dec(dias),
        monto: d.monto !== undefined ? dec(d.monto) : null,
        motivo: d.motivo,
      })
      .returning({ id: solicitudesRrhh.id });
    revalidatePath("/rrhh/solicitudes");
    return { ok: true, id: creada.id };
  } catch (err) {
    console.error("[crearSolicitud]", err);
    return { ok: false, error: "No pudimos crear la solicitud." };
  }
}

export async function resolverSolicitud(
  id: string,
  aprobar: boolean,
  comentario?: string,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    await db
      .update(solicitudesRrhh)
      .set({
        estado: aprobar ? "aprobada" : "rechazada",
        comentarioResolucion: comentario || null,
        resueltoPor: user.id,
        resueltoEn: new Date(),
      })
      .where(
        and(
          eq(solicitudesRrhh.id, id),
          eq(solicitudesRrhh.empresaId, user.empresaId),
          eq(solicitudesRrhh.estado, "pendiente"),
        ),
      );
    revalidatePath("/rrhh/solicitudes");
    return { ok: true };
  } catch (err) {
    console.error("[resolverSolicitud]", err);
    return { ok: false, error: "No pudimos resolver la solicitud." };
  }
}

/* ============================ NÓMINA ============================ */

export async function generarNomina(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = nominaGenerarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [empresa] = await db
      .select({ pais: empresas.pais })
      .from(empresas)
      .where(eq(empresas.id, user.empresaId))
      .limit(1);
    const pais = (empresa?.pais ?? "NI") as PaisCodigo;
    const tasaSS = TASA_SEGURIDAD_SOCIAL[pais] ?? 0;

    const activos = await db
      .select({
        id: empleados.id,
        salarioBase: empleados.salarioBase,
        frecuenciaPago: empleados.frecuenciaPago,
      })
      .from(empleados)
      .where(
        and(
          eq(empleados.empresaId, user.empresaId),
          eq(empleados.frecuenciaPago, d.frecuencia),
          isNull(empleados.eliminadoEn),
          sql`${empleados.estado} <> 'baja'`,
        ),
      );

    if (activos.length === 0) {
      return {
        ok: false,
        error: `No hay empleados activos con pago ${d.frecuencia}.`,
      };
    }

    const idsEmpleados = activos.map((e) => e.id);
    const asistPeriodo = await db
      .select({
        empleadoId: asistencias.empleadoId,
        horasExtra: asistencias.horasExtra,
        estado: asistencias.estado,
      })
      .from(asistencias)
      .where(
        and(
          eq(asistencias.empresaId, user.empresaId),
          gte(asistencias.fecha, d.periodoInicio),
          lte(asistencias.fecha, d.periodoFin),
        ),
      );

    const extrasPorEmpleado = new Map<string, number>();
    const ausentesPorEmpleado = new Map<string, number>();
    for (const a of asistPeriodo) {
      if (!idsEmpleados.includes(a.empleadoId)) continue;
      extrasPorEmpleado.set(
        a.empleadoId,
        (extrasPorEmpleado.get(a.empleadoId) ?? 0) + num(a.horasExtra),
      );
      if (a.estado === "ausente") {
        ausentesPorEmpleado.set(
          a.empleadoId,
          (ausentesPorEmpleado.get(a.empleadoId) ?? 0) + 1,
        );
      }
    }

    const factor = factorPeriodo(d.frecuencia);
    const diasPeriodo = diasDelPeriodo(d.frecuencia);

    const detalles = activos.map((e) => {
      const salarioMensual = num(e.salarioBase);
      const ausentes = ausentesPorEmpleado.get(e.id) ?? 0;
      const diasTrabajados = Math.max(diasPeriodo - ausentes, 0);
      const salarioPeriodo = salarioMensual * factor * (diasTrabajados / diasPeriodo);
      const horasExtra = extrasPorEmpleado.get(e.id) ?? 0;
      const salarioHora = salarioMensual / 240;
      const montoHorasExtra = horasExtra * salarioHora * 1.5;
      const totalDevengado = salarioPeriodo + montoHorasExtra;
      const deduccionSS = totalDevengado * tasaSS;
      const totalDeducciones = deduccionSS;
      const totalNeto = totalDevengado - totalDeducciones;
      return {
        empleadoId: e.id,
        salarioBase: salarioMensual,
        diasTrabajados,
        horasExtra,
        montoHorasExtra,
        totalDevengado,
        deduccionSS,
        totalDeducciones,
        totalNeto,
      };
    });

    const totDevengado = detalles.reduce((s, x) => s + x.totalDevengado, 0);
    const totDeducciones = detalles.reduce((s, x) => s + x.totalDeducciones, 0);
    const totNeto = detalles.reduce((s, x) => s + x.totalNeto, 0);

    // Correlativo NOM-YYYY-NNNNNN
    const anio = fechaMediodia(d.fechaPago).getFullYear();
    const [ultima] = await db
      .select({ numero: nominas.numero })
      .from(nominas)
      .where(
        and(
          eq(nominas.empresaId, user.empresaId),
          sql`${nominas.numero} like ${"NOM-" + anio + "-%"}`,
        ),
      )
      .orderBy(desc(nominas.numero))
      .limit(1);
    const sec = ultima ? parseInt(ultima.numero.split("-").pop() ?? "0", 10) + 1 : 1;
    const numero = `NOM-${anio}-${String(sec).padStart(6, "0")}`;

    const nominaId = await db.transaction(async (tx) => {
      const [nom] = await tx
        .insert(nominas)
        .values({
          empresaId: user.empresaId,
          numero,
          descripcion: d.descripcion,
          frecuencia: d.frecuencia,
          periodoInicio: d.periodoInicio,
          periodoFin: d.periodoFin,
          fechaPago: d.fechaPago,
          estado: "borrador",
          empleadosCount: detalles.length,
          totalDevengado: dec(totDevengado),
          totalDeducciones: dec(totDeducciones),
          totalNeto: dec(totNeto),
          creadoPor: user.id,
        })
        .returning({ id: nominas.id });

      await tx.insert(nominaDetalles).values(
        detalles.map((x) => ({
          empresaId: user.empresaId,
          nominaId: nom.id,
          empleadoId: x.empleadoId,
          salarioBase: dec(x.salarioBase),
          diasTrabajados: dec(x.diasTrabajados),
          horasExtra: dec(x.horasExtra),
          montoHorasExtra: dec(x.montoHorasExtra),
          totalDevengado: dec(x.totalDevengado),
          deduccionSeguridadSocial: dec(x.deduccionSS),
          totalDeducciones: dec(x.totalDeducciones),
          totalNeto: dec(x.totalNeto),
        })),
      );
      return nom.id;
    });

    revalidatePath("/rrhh/nomina");
    return { ok: true, id: nominaId };
  } catch (err) {
    console.error("[generarNomina]", err);
    return { ok: false, error: "No pudimos generar la nómina." };
  }
}

export async function aprobarNomina(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    const [nom] = await db
      .select()
      .from(nominas)
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)))
      .limit(1);
    if (!nom) return { ok: false, error: "Nómina no encontrada." };
    if (nom.estado !== "borrador") {
      return { ok: false, error: "Solo se puede aprobar una nómina en borrador." };
    }

    const asientoId = await registrarNominaDevengo({
      empresaId: user.empresaId,
      usuarioId: user.id,
      nominaId: nom.id,
      fecha: fechaMediodia(nom.fechaPago),
      numero: nom.numero,
      totalDevengado: num(nom.totalDevengado),
      totalDeducciones: num(nom.totalDeducciones),
      totalNeto: num(nom.totalNeto),
    });

    await db
      .update(nominas)
      .set({
        estado: "aprobada",
        asientoDevengoId: asientoId,
        aprobadoPor: user.id,
        aprobadoEn: new Date(),
      })
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)));

    revalidatePath("/rrhh/nomina");
    revalidatePath(`/rrhh/nomina/${id}`);
    revalidatePath("/contabilidad/libro-diario");
    return { ok: true };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "PeriodoCerradoError"
        ? "El período contable de la fecha de pago está cerrado."
        : "No pudimos aprobar la nómina.";
    console.error("[aprobarNomina]", err);
    return { ok: false, error: msg };
  }
}

export async function pagarNomina(
  id: string,
  cuentaFinancieraId: string,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  if (!cuentaFinancieraId) {
    return { ok: false, error: "Selecciona la cuenta de pago." };
  }
  try {
    const [nom] = await db
      .select()
      .from(nominas)
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)))
      .limit(1);
    if (!nom) return { ok: false, error: "Nómina no encontrada." };
    if (nom.estado !== "aprobada") {
      return { ok: false, error: "Solo se puede pagar una nómina aprobada." };
    }

    const asientoId = await registrarPagoNomina({
      empresaId: user.empresaId,
      usuarioId: user.id,
      nominaId: nom.id,
      fecha: fechaMediodia(nom.fechaPago),
      numero: nom.numero,
      monto: num(nom.totalNeto),
      cuentaFinancieraId,
    });

    await db
      .update(nominas)
      .set({
        estado: "pagada",
        asientoPagoId: asientoId,
        cuentaFinancieraId,
        pagadoEn: new Date(),
      })
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)));

    revalidatePath("/rrhh/nomina");
    revalidatePath(`/rrhh/nomina/${id}`);
    revalidatePath("/contabilidad/libro-diario");
    return { ok: true };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "PeriodoCerradoError"
        ? "El período contable de la fecha de pago está cerrado."
        : "No pudimos pagar la nómina.";
    console.error("[pagarNomina]", err);
    return { ok: false, error: msg };
  }
}

export async function eliminarNominaBorrador(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    const [nom] = await db
      .select({ estado: nominas.estado })
      .from(nominas)
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)))
      .limit(1);
    if (!nom) return { ok: false, error: "Nómina no encontrada." };
    if (nom.estado !== "borrador") {
      return {
        ok: false,
        error: "Solo se puede eliminar una nómina en borrador. Una aprobada requiere reverso contable.",
      };
    }
    await db.delete(nominas).where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)));
    revalidatePath("/rrhh/nomina");
    return { ok: true };
  } catch (err) {
    console.error("[eliminarNominaBorrador]", err);
    return { ok: false, error: "No pudimos eliminar la nómina." };
  }
}

/* ============================ RECLUTAMIENTO ============================ */

export async function crearVacante(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = vacanteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const codigo = await siguienteCodigoVacante(user.empresaId);
    const [creada] = await db
      .insert(vacantes)
      .values({
        empresaId: user.empresaId,
        codigo,
        sucursalId: d.sucursalId || null,
        titulo: d.titulo,
        departamento: d.departamento || null,
        descripcion: d.descripcion || null,
        requisitos: d.requisitos || null,
        tipoContrato: d.tipoContrato,
        salarioMin: d.salarioMin !== undefined ? dec(d.salarioMin) : null,
        salarioMax: d.salarioMax !== undefined ? dec(d.salarioMax) : null,
        plazas: d.plazas,
        estado: "abierta",
        fechaApertura: new Date().toISOString().slice(0, 10),
        creadoPor: user.id,
      })
      .returning({ id: vacantes.id });
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, id: creada.id };
  } catch (err) {
    console.error("[crearVacante]", err);
    return { ok: false, error: "No pudimos crear la vacante." };
  }
}

export async function cambiarEstadoVacante(
  id: string,
  estado: "abierta" | "pausada" | "cerrada" | "cancelada",
): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    await db
      .update(vacantes)
      .set({
        estado,
        fechaCierre:
          estado === "cerrada" || estado === "cancelada"
            ? new Date().toISOString().slice(0, 10)
            : null,
      })
      .where(and(eq(vacantes.id, id), eq(vacantes.empresaId, user.empresaId)));
    revalidatePath("/rrhh/reclutamiento");
    revalidatePath(`/rrhh/reclutamiento/${id}`);
    return { ok: true };
  } catch (err) {
    console.error("[cambiarEstadoVacante]", err);
    return { ok: false, error: "No pudimos cambiar el estado." };
  }
}

export async function crearCandidato(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = candidatoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [vac] = await db
      .select({ id: vacantes.id })
      .from(vacantes)
      .where(and(eq(vacantes.id, d.vacanteId), eq(vacantes.empresaId, user.empresaId)))
      .limit(1);
    if (!vac) return { ok: false, error: "Vacante no encontrada." };

    const [creado] = await db
      .insert(candidatos)
      .values({
        empresaId: user.empresaId,
        vacanteId: d.vacanteId,
        nombres: d.nombres,
        apellidos: d.apellidos,
        email: d.email || null,
        telefono: d.telefono || null,
        fuente: d.fuente || null,
        expectativaSalarial:
          d.expectativaSalarial !== undefined ? dec(d.expectativaSalarial) : null,
        etapa: "aplicado",
        notas: d.notas || null,
      })
      .returning({ id: candidatos.id });
    revalidatePath(`/rrhh/reclutamiento/${d.vacanteId}`);
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearCandidato]", err);
    return { ok: false, error: "No pudimos registrar el candidato." };
  }
}

export async function moverEtapaCandidato(
  id: string,
  etapa: "aplicado" | "preseleccion" | "entrevista" | "oferta" | "contratado" | "descartado",
  calificacion?: number,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  try {
    const [cand] = await db
      .select({ vacanteId: candidatos.vacanteId })
      .from(candidatos)
      .where(and(eq(candidatos.id, id), eq(candidatos.empresaId, user.empresaId)))
      .limit(1);
    if (!cand) return { ok: false, error: "Candidato no encontrado." };

    await db
      .update(candidatos)
      .set({
        etapa,
        calificacion:
          calificacion !== undefined && calificacion >= 1 && calificacion <= 5
            ? calificacion
            : undefined,
      })
      .where(and(eq(candidatos.id, id), eq(candidatos.empresaId, user.empresaId)));
    revalidatePath(`/rrhh/reclutamiento/${cand.vacanteId}`);
    return { ok: true };
  } catch (err) {
    console.error("[moverEtapaCandidato]", err);
    return { ok: false, error: "No pudimos actualizar el candidato." };
  }
}

/** Convierte un candidato contratado en empleado (borrador con datos base). */
export async function contratarCandidato(
  id: string,
  datos: { puesto: string; salarioBase: number; fechaIngreso: string; frecuenciaPago: "semanal" | "quincenal" | "mensual" },
): Promise<Resultado> {
  const user = await requireSession();
  try {
    const [cand] = await db
      .select()
      .from(candidatos)
      .where(and(eq(candidatos.id, id), eq(candidatos.empresaId, user.empresaId)))
      .limit(1);
    if (!cand) return { ok: false, error: "Candidato no encontrado." };

    const codigo = await siguienteCodigoEmpleado(user.empresaId);
    const res = await db.transaction(async (tx) => {
      const [emp] = await tx
        .insert(empleados)
        .values({
          empresaId: user.empresaId,
          codigo,
          nombres: cand.nombres,
          apellidos: cand.apellidos,
          email: cand.email,
          telefono: cand.telefono,
          puesto: datos.puesto,
          tipoContrato: "indefinido",
          fechaIngreso: datos.fechaIngreso,
          salarioBase: dec(datos.salarioBase),
          frecuenciaPago: datos.frecuenciaPago,
          estado: "activo",
        })
        .returning({ id: empleados.id });

      await tx
        .update(candidatos)
        .set({ etapa: "contratado" })
        .where(eq(candidatos.id, id));
      return emp.id;
    });
    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/reclutamiento/${cand.vacanteId}`);
    return { ok: true, id: res };
  } catch (err) {
    console.error("[contratarCandidato]", err);
    return { ok: false, error: "No pudimos contratar al candidato." };
  }
}
