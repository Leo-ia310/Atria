"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, isNull, lte, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empleados,
  asistencias,
  feriados,
  nominas,
  nominaDetalles,
  nominaDeducciones,
  tiposDeduccion,
  solicitudesRrhh,
  vacantes,
  candidatos,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import {
  empleadoSchema,
  asistenciaSchema,
  solicitudSchema,
  feriadoSchema,
  actualizarFeriadoSchema,
  nominaGenerarSchema,
  vacanteSchema,
  candidatoSchema,
  tipoDeduccionSchema,
  deduccionVariableSchema,
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
  calcularIRMensual,
  SOLICITUD_TIPO_LABEL,
} from "@/lib/rrhh";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { validarAccion } from "@/lib/server-access";

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

async function validarAccesoRrhh(user: Awaited<ReturnType<typeof requireSession>>) {
  return validarAccion(user, { modulo: "rrhh", soloAdmin: true });
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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

export async function actualizarFeriado(
  id: string,
  input: unknown,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = actualizarFeriadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    await db
      .update(feriados)
      .set({ nombre: d.nombre, fecha: d.fecha })
      .where(and(eq(feriados.id, id), eq(feriados.empresaId, user.empresaId)));
    revalidatePath("/rrhh/nomina");
    revalidatePath("/rrhh/feriados");
    return { ok: true };
  } catch (err) {
    console.error("[actualizarFeriado]", err);
    return { ok: false, error: "No pudimos actualizar el feriado." };
  }
}

export async function eliminarFeriado(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  try {
    const empresa = await getEmpresaMetadata(user.empresaId);
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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

    // Evitar solicitudes con fechas solapadas para el mismo empleado.
    // Solo aplica a solicitudes con rango de fechas (permiso, vacaciones, etc.).
    if (d.fechaInicio && d.fechaFin) {
      const solapada = await db
        .select({
          id: solicitudesRrhh.id,
          tipo: solicitudesRrhh.tipo,
          fechaInicio: solicitudesRrhh.fechaInicio,
          fechaFin: solicitudesRrhh.fechaFin,
        })
        .from(solicitudesRrhh)
        .where(
          and(
            eq(solicitudesRrhh.empresaId, user.empresaId),
            eq(solicitudesRrhh.empleadoId, d.empleadoId),
            sql`${solicitudesRrhh.estado} not in ('rechazada', 'cancelada')`,
            sql`${solicitudesRrhh.fechaInicio} is not null`,
            sql`${solicitudesRrhh.fechaFin} is not null`,
            lte(solicitudesRrhh.fechaInicio, d.fechaFin),
            gte(solicitudesRrhh.fechaFin, d.fechaInicio),
          ),
        )
        .limit(1);
      if (solapada.length > 0) {
        const s = solapada[0];
        return {
          ok: false,
          error: `El empleado ya tiene una solicitud (${SOLICITUD_TIPO_LABEL[s.tipo] ?? s.tipo}) del ${s.fechaInicio} al ${s.fechaFin} que se solapa con esas fechas.`,
        };
      }
    }

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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = nominaGenerarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const empresa = await getEmpresaMetadata(user.empresaId);
    const pais = (empresa?.pais ?? "NI") as PaisCodigo;
    const tasaSS = TASA_SEGURIDAD_SOCIAL[pais] ?? 0;

    // La nómina se genera para TODOS los empleados activos según el período
    // elegido. La frecuencia de pago del empleado no restringe la generación
    // (siempre se puede pagar semanal/quincenal/mensual).
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
          isNull(empleados.eliminadoEn),
          sql`${empleados.estado} <> 'baja'`,
        ),
      );

    if (activos.length === 0) {
      return {
        ok: false,
        error: "No hay empleados activos para generar la nómina.",
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
      // IR: se calcula sobre la base gravable mensual (salario menos seguridad
      // social) y se prorratea al período trabajado.
      const baseGravableMensual = salarioMensual - salarioMensual * tasaSS;
      const irMensual = calcularIRMensual(pais, baseGravableMensual);
      const deduccionRenta =
        irMensual * factor * (diasTrabajados / diasPeriodo);
      const totalDeducciones = deduccionSS + deduccionRenta;
      const totalNeto = totalDevengado - totalDeducciones;
      return {
        empleadoId: e.id,
        salarioBase: salarioMensual,
        diasTrabajados,
        horasExtra,
        montoHorasExtra,
        totalDevengado,
        deduccionSS,
        deduccionRenta,
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
          deduccionRenta: dec(x.deduccionRenta),
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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

/* =====================  Deducciones variables y verificación  ===================== */

const VERIFICACIONES_REQUERIDAS = 3;

// Recalcula 'otras deducciones' del recibo (suma de deducciones variables) y los
// totales del recibo y de la nómina completa.
async function recalcularDeduccionesDetalle(detalleId: string): Promise<string | null> {
  const [{ otras }] = await db
    .select({ otras: sum(nominaDeducciones.monto) })
    .from(nominaDeducciones)
    .where(eq(nominaDeducciones.nominaDetalleId, detalleId));
  const [det] = await db
    .select({
      nominaId: nominaDetalles.nominaId,
      totalDevengado: nominaDetalles.totalDevengado,
      ss: nominaDetalles.deduccionSeguridadSocial,
      ir: nominaDetalles.deduccionRenta,
    })
    .from(nominaDetalles)
    .where(eq(nominaDetalles.id, detalleId))
    .limit(1);
  if (!det) return null;

  const otrasN = num(otras ?? 0);
  const totalDed = num(det.ss) + num(det.ir) + otrasN;
  const neto = num(det.totalDevengado) - totalDed;
  await db
    .update(nominaDetalles)
    .set({
      otrasDeducciones: dec(otrasN),
      totalDeducciones: dec(totalDed),
      totalNeto: dec(neto),
    })
    .where(eq(nominaDetalles.id, detalleId));

  const [tot] = await db
    .select({
      ded: sum(nominaDetalles.totalDeducciones),
      neto: sum(nominaDetalles.totalNeto),
    })
    .from(nominaDetalles)
    .where(eq(nominaDetalles.nominaId, det.nominaId));
  await db
    .update(nominas)
    .set({
      totalDeducciones: dec(num(tot?.ded ?? 0)),
      totalNeto: dec(num(tot?.neto ?? 0)),
    })
    .where(eq(nominas.id, det.nominaId));

  return det.nominaId;
}

export async function crearTipoDeduccion(
  input: unknown,
): Promise<{ ok: true; id: string; nombre: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = tipoDeduccionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const nombre = parsed.data.nombre.trim();
  try {
    const yaExiste = await db
      .select({ id: tiposDeduccion.id, nombre: tiposDeduccion.nombre })
      .from(tiposDeduccion)
      .where(and(eq(tiposDeduccion.empresaId, user.empresaId), eq(tiposDeduccion.nombre, nombre)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: true, id: yaExiste[0].id, nombre: yaExiste[0].nombre };
    }
    const [creado] = await db
      .insert(tiposDeduccion)
      .values({ empresaId: user.empresaId, nombre })
      .returning({ id: tiposDeduccion.id, nombre: tiposDeduccion.nombre });
    revalidatePath("/rrhh/deducciones");
    return { ok: true, id: creado.id, nombre: creado.nombre };
  } catch (err) {
    console.error("[crearTipoDeduccion]", err);
    return { ok: false, error: "No pudimos crear el tipo de deducción." };
  }
}

export async function agregarDeduccionVariable(input: unknown): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = deduccionVariableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  try {
    const [det] = await db
      .select({ id: nominaDetalles.id, estado: nominas.estado, nominaId: nominas.id })
      .from(nominaDetalles)
      .innerJoin(nominas, eq(nominas.id, nominaDetalles.nominaId))
      .where(
        and(
          eq(nominaDetalles.id, d.nominaDetalleId),
          eq(nominaDetalles.empresaId, user.empresaId),
        ),
      )
      .limit(1);
    if (!det) return { ok: false, error: "Recibo no encontrado." };
    if (det.estado !== "borrador") {
      return { ok: false, error: "La nómina ya está verificada; no se pueden agregar deducciones." };
    }
    const [tipo] = await db
      .select({ id: tiposDeduccion.id })
      .from(tiposDeduccion)
      .where(and(eq(tiposDeduccion.id, d.tipoDeduccionId), eq(tiposDeduccion.empresaId, user.empresaId)))
      .limit(1);
    if (!tipo) return { ok: false, error: "Tipo de deducción inválido." };

    await db.insert(nominaDeducciones).values({
      empresaId: user.empresaId,
      nominaDetalleId: d.nominaDetalleId,
      tipoDeduccionId: d.tipoDeduccionId,
      monto: dec(d.monto),
      nota: d.nota || null,
    });
    await recalcularDeduccionesDetalle(d.nominaDetalleId);
    revalidatePath("/rrhh/deducciones");
    revalidatePath(`/rrhh/nomina/${det.nominaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[agregarDeduccionVariable]", err);
    return { ok: false, error: "No pudimos agregar la deducción." };
  }
}

export async function eliminarDeduccionVariable(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  try {
    const [ded] = await db
      .select({
        id: nominaDeducciones.id,
        detalleId: nominaDeducciones.nominaDetalleId,
        estado: nominas.estado,
        nominaId: nominas.id,
      })
      .from(nominaDeducciones)
      .innerJoin(nominaDetalles, eq(nominaDetalles.id, nominaDeducciones.nominaDetalleId))
      .innerJoin(nominas, eq(nominas.id, nominaDetalles.nominaId))
      .where(
        and(eq(nominaDeducciones.id, id), eq(nominaDeducciones.empresaId, user.empresaId)),
      )
      .limit(1);
    if (!ded) return { ok: false, error: "Deducción no encontrada." };
    if (ded.estado !== "borrador") {
      return { ok: false, error: "La nómina ya está verificada; no se pueden quitar deducciones." };
    }
    await db.delete(nominaDeducciones).where(eq(nominaDeducciones.id, id));
    await recalcularDeduccionesDetalle(ded.detalleId);
    revalidatePath("/rrhh/deducciones");
    revalidatePath(`/rrhh/nomina/${ded.nominaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[eliminarDeduccionVariable]", err);
    return { ok: false, error: "No pudimos quitar la deducción." };
  }
}

// Verificación en 3 pasos. En el paso 3 se bloquea la nómina y se genera el
// asiento de devengo (reutiliza la misma lógica contable que aprobarNomina).
export async function verificarNomina(
  id: string,
): Promise<{ ok: true; nivel: number; bloqueada: boolean } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  try {
    const [nom] = await db
      .select()
      .from(nominas)
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)))
      .limit(1);
    if (!nom) return { ok: false, error: "Nómina no encontrada." };
    if (nom.estado !== "borrador") {
      return { ok: false, error: "La nómina ya está verificada." };
    }

    const nuevoNivel = Math.min(nom.nivelVerificacion + 1, VERIFICACIONES_REQUERIDAS);

    if (nuevoNivel < VERIFICACIONES_REQUERIDAS) {
      await db
        .update(nominas)
        .set({ nivelVerificacion: nuevoNivel })
        .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)));
      revalidatePath(`/rrhh/nomina/${id}`);
      revalidatePath("/rrhh/nomina");
      revalidatePath("/rrhh/deducciones");
      return { ok: true, nivel: nuevoNivel, bloqueada: false };
    }

    // Tercera verificación: bloquear + generar devengo contable.
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
        nivelVerificacion: VERIFICACIONES_REQUERIDAS,
        estado: "aprobada",
        asientoDevengoId: asientoId,
        aprobadoPor: user.id,
        aprobadoEn: new Date(),
      })
      .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)));

    revalidatePath(`/rrhh/nomina/${id}`);
    revalidatePath("/rrhh/nomina");
    revalidatePath("/rrhh/deducciones");
    revalidatePath("/contabilidad/libro-diario");
    return { ok: true, nivel: VERIFICACIONES_REQUERIDAS, bloqueada: true };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "PeriodoCerradoError"
        ? "El período contable de la fecha de pago está cerrado."
        : "No pudimos verificar la nómina.";
    console.error("[verificarNomina]", err);
    return { ok: false, error: msg };
  }
}

// Marca el pago de un recibo individual (operativo, sin asiento). El asiento de
// pago consolidado se genera al finalizar (finalizarPagoNomina).
export async function pagarDetalleNomina(
  detalleId: string,
  pagar: boolean,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  try {
    const [det] = await db
      .select({ id: nominaDetalles.id, estado: nominas.estado, nominaId: nominas.id })
      .from(nominaDetalles)
      .innerJoin(nominas, eq(nominas.id, nominaDetalles.nominaId))
      .where(
        and(eq(nominaDetalles.id, detalleId), eq(nominaDetalles.empresaId, user.empresaId)),
      )
      .limit(1);
    if (!det) return { ok: false, error: "Recibo no encontrado." };
    if (det.estado !== "aprobada") {
      return {
        ok: false,
        error: "La nómina debe estar verificada (3/3) para registrar pagos.",
      };
    }
    await db
      .update(nominaDetalles)
      .set({
        estadoPago: pagar ? "pagado" : "pendiente",
        pagadoEn: pagar ? new Date() : null,
      })
      .where(eq(nominaDetalles.id, detalleId));
    revalidatePath(`/rrhh/nomina/${det.nominaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[pagarDetalleNomina]", err);
    return { ok: false, error: "No pudimos actualizar el pago." };
  }
}

// Paga a todos y finaliza: marca todos los recibos como pagados, genera el
// asiento de pago consolidado y deja la nómina como pagada.
export async function finalizarPagoNomina(
  id: string,
  cuentaFinancieraId: string,
): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
      return { ok: false, error: "Solo se puede pagar una nómina verificada (3/3)." };
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
      .update(nominaDetalles)
      .set({ estadoPago: "pagado", pagadoEn: new Date() })
      .where(eq(nominaDetalles.nominaId, id));

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
    console.error("[finalizarPagoNomina]", err);
    return { ok: false, error: msg };
  }
}

/* ============================ RECLUTAMIENTO ============================ */

export async function crearVacante(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
        habilidades: d.habilidades && d.habilidades.length > 0 ? d.habilidades : null,
        experienciaAnios: d.experienciaAnios ?? null,
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
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
