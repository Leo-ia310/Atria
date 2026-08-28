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
  nominaIngresos,
  tiposIngreso,
  nominaColillas,
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
  tipoIngresoSchema,
  ingresoVariableSchema,
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
  SEGURIDAD_SOCIAL_NOMBRE,
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
        ciudad: d.ciudad || null,
        municipio: d.municipio || null,
        estadoCivil: d.estadoCivil || null,
        nacionalidad: d.nacionalidad || null,
        profesionOficio: d.profesionOficio || null,
        dependientes: d.dependientes,
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
        ciudad: d.ciudad || null,
        municipio: d.municipio || null,
        estadoCivil: d.estadoCivil || null,
        nacionalidad: d.nacionalidad || null,
        profesionOficio: d.profesionOficio || null,
        dependientes: d.dependientes,
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
    const idsEmpleadosSet = new Set(idsEmpleados);
    for (const a of asistPeriodo) {
      if (!idsEmpleadosSet.has(a.empleadoId)) continue;
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

async function aprobarNomina(id: string): Promise<ResultadoSimple> {
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

async function pagarNomina(
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

async function recalcularTotalesNomina(nominaId: string) {
  const [tot] = await db
    .select({
      dev: sum(nominaDetalles.totalDevengado),
      ded: sum(nominaDetalles.totalDeducciones),
      neto: sum(nominaDetalles.totalNeto),
    })
    .from(nominaDetalles)
    .where(eq(nominaDetalles.nominaId, nominaId));
  await db
    .update(nominas)
    .set({
      totalDevengado: dec(num(tot?.dev ?? 0)),
      totalDeducciones: dec(num(tot?.ded ?? 0)),
      totalNeto: dec(num(tot?.neto ?? 0)),
    })
    .where(eq(nominas.id, nominaId));
}

// Recalcula 'otras deducciones' del recibo (suma de deducciones variables) y los
// totales del recibo y de la nómina completa.
async function recalcularDeduccionesDetalle(detalleId: string): Promise<string | null> {
  const [[{ otras }], [det]] = await Promise.all([
    db
      .select({ otras: sum(nominaDeducciones.monto) })
      .from(nominaDeducciones)
      .where(eq(nominaDeducciones.nominaDetalleId, detalleId)),
    db
      .select({
        nominaId: nominaDetalles.nominaId,
        totalDevengado: nominaDetalles.totalDevengado,
        ss: nominaDetalles.deduccionSeguridadSocial,
        ir: nominaDetalles.deduccionRenta,
      })
      .from(nominaDetalles)
      .where(eq(nominaDetalles.id, detalleId))
      .limit(1),
  ]);
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

  await recalcularTotalesNomina(det.nominaId);

  return det.nominaId;
}

async function recalcularIngresosDetalle(detalleId: string): Promise<string | null> {
  const [[{ ingresos }], [det]] = await Promise.all([
    db
      .select({ ingresos: sum(nominaIngresos.monto) })
      .from(nominaIngresos)
      .where(eq(nominaIngresos.nominaDetalleId, detalleId)),
    db
      .select({
        nominaId: nominaDetalles.nominaId,
        totalDevengado: nominaDetalles.totalDevengado,
        bonificaciones: nominaDetalles.bonificaciones,
        comisiones: nominaDetalles.comisiones,
        totalDeducciones: nominaDetalles.totalDeducciones,
      })
      .from(nominaDetalles)
      .where(eq(nominaDetalles.id, detalleId))
      .limit(1),
  ]);
  if (!det) return null;

  const ingresosN = num(ingresos ?? 0);
  const baseDevengado =
    num(det.totalDevengado) - num(det.bonificaciones) - num(det.comisiones);
  const totalDevengado = baseDevengado + ingresosN + num(det.comisiones);
  const neto = totalDevengado - num(det.totalDeducciones);
  await db
    .update(nominaDetalles)
    .set({
      bonificaciones: dec(ingresosN),
      totalDevengado: dec(totalDevengado),
      totalNeto: dec(neto),
    })
    .where(eq(nominaDetalles.id, detalleId));
  await recalcularTotalesNomina(det.nominaId);
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
      semana: d.semana,
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
export async function crearTipoIngreso(
  input: unknown,
): Promise<{ ok: true; id: string; nombre: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = tipoIngresoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const nombre = parsed.data.nombre.trim();
  try {
    const yaExiste = await db
      .select({ id: tiposIngreso.id, nombre: tiposIngreso.nombre })
      .from(tiposIngreso)
      .where(and(eq(tiposIngreso.empresaId, user.empresaId), eq(tiposIngreso.nombre, nombre)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: true, id: yaExiste[0].id, nombre: yaExiste[0].nombre };
    }
    const [creado] = await db
      .insert(tiposIngreso)
      .values({ empresaId: user.empresaId, nombre })
      .returning({ id: tiposIngreso.id, nombre: tiposIngreso.nombre });
    revalidatePath("/rrhh/ingresos");
    return { ok: true, id: creado.id, nombre: creado.nombre };
  } catch (err) {
    console.error("[crearTipoIngreso]", err);
    return { ok: false, error: "No pudimos crear el tipo de ingreso." };
  }
}

export async function agregarIngresoVariable(input: unknown): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  const parsed = ingresoVariableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
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
      return { ok: false, error: "La nomina ya esta verificada; no se pueden agregar ingresos." };
    }
    const [tipo] = await db
      .select({ id: tiposIngreso.id })
      .from(tiposIngreso)
      .where(and(eq(tiposIngreso.id, d.tipoIngresoId), eq(tiposIngreso.empresaId, user.empresaId)))
      .limit(1);
    if (!tipo) return { ok: false, error: "Tipo de ingreso invalido." };

    await db.insert(nominaIngresos).values({
      empresaId: user.empresaId,
      nominaDetalleId: d.nominaDetalleId,
      tipoIngresoId: d.tipoIngresoId,
      monto: dec(d.monto),
      semana: d.semana,
      nota: d.nota || null,
    });
    await recalcularIngresosDetalle(d.nominaDetalleId);
    revalidatePath("/rrhh/ingresos");
    revalidatePath(`/rrhh/nomina/${det.nominaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[agregarIngresoVariable]", err);
    return { ok: false, error: "No pudimos agregar el ingreso." };
  }
}

export async function eliminarIngresoVariable(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccesoRrhh(user);
  if (!acceso.ok) return acceso;
  try {
    const [ing] = await db
      .select({
        id: nominaIngresos.id,
        detalleId: nominaIngresos.nominaDetalleId,
        estado: nominas.estado,
        nominaId: nominas.id,
      })
      .from(nominaIngresos)
      .innerJoin(nominaDetalles, eq(nominaDetalles.id, nominaIngresos.nominaDetalleId))
      .innerJoin(nominas, eq(nominas.id, nominaDetalles.nominaId))
      .where(and(eq(nominaIngresos.id, id), eq(nominaIngresos.empresaId, user.empresaId)))
      .limit(1);
    if (!ing) return { ok: false, error: "Ingreso no encontrado." };
    if (ing.estado !== "borrador") {
      return { ok: false, error: "La nomina ya esta verificada; no se pueden quitar ingresos." };
    }
    await db.delete(nominaIngresos).where(eq(nominaIngresos.id, id));
    await recalcularIngresosDetalle(ing.detalleId);
    revalidatePath("/rrhh/ingresos");
    revalidatePath(`/rrhh/nomina/${ing.nominaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[eliminarIngresoVariable]", err);
    return { ok: false, error: "No pudimos quitar el ingreso." };
  }
}

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
      revalidatePath("/rrhh/ingresos");
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
    revalidatePath("/rrhh/ingresos");
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

type LineaColilla = { concepto: string; monto: number; nota?: string | null };

function sumarLineas(lineas: LineaColilla[]): number {
  return lineas.reduce((acc, linea) => acc + linea.monto, 0);
}

function crearSemanasPeriodo(inicioIso: string, finIso: string) {
  const inicio = fechaMediodia(inicioIso);
  const fin = fechaMediodia(finIso);
  const diasTotal = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1);
  const diasSemana1 = Math.ceil(diasTotal / 2);
  const finSemana1 = new Date(inicio);
  finSemana1.setDate(inicio.getDate() + diasSemana1 - 1);
  return [
    {
      clave: "semana_1",
      label: "Semana 1",
      inicio,
      fin: finSemana1 > fin ? fin : finSemana1,
      factor: diasSemana1 / diasTotal,
      ingresos: [] as LineaColilla[],
      deducciones: [] as LineaColilla[],
    },
    {
      clave: "semana_2",
      label: "Semana 2",
      inicio: new Date(finSemana1.getTime() + 86400000),
      fin,
      factor: Math.max(diasTotal - diasSemana1, 0) / diasTotal,
      ingresos: [] as LineaColilla[],
      deducciones: [] as LineaColilla[],
    },
  ];
}

function agregarVariablePorSemana(
  semanas: ReturnType<typeof crearSemanasPeriodo>,
  semana: string,
  linea: LineaColilla,
  tipo: "ingresos" | "deducciones",
) {
  if (semana === "semana_1" || semana === "semana_2") {
    semanas.find((s) => s.clave === semana)?.[tipo].push(linea);
    return;
  }
  const mitad = linea.monto / 2;
  semanas[0][tipo].push({ ...linea, monto: mitad });
  semanas[1][tipo].push({ ...linea, monto: linea.monto - mitad });
}

async function guardarColillaDetalle(detalleId: string) {
  const [row] = await db
    .select({
      detalleId: nominaDetalles.id,
      nominaId: nominas.id,
      empresaId: nominas.empresaId,
      numeroNomina: nominas.numero,
      descripcion: nominas.descripcion,
      frecuencia: nominas.frecuencia,
      periodoInicio: nominas.periodoInicio,
      periodoFin: nominas.periodoFin,
      fechaPago: nominas.fechaPago,
      empleadoId: empleados.id,
      codigo: empleados.codigo,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      puesto: empleados.puesto,
      departamento: empleados.departamento,
      salarioMensual: nominaDetalles.salarioBase,
      diasTrabajados: nominaDetalles.diasTrabajados,
      horasExtra: nominaDetalles.horasExtra,
      montoHorasExtra: nominaDetalles.montoHorasExtra,
      bonificaciones: nominaDetalles.bonificaciones,
      comisiones: nominaDetalles.comisiones,
      deduccionSS: nominaDetalles.deduccionSeguridadSocial,
      deduccionRenta: nominaDetalles.deduccionRenta,
      otrasDeducciones: nominaDetalles.otrasDeducciones,
      totalDevengado: nominaDetalles.totalDevengado,
      totalDeducciones: nominaDetalles.totalDeducciones,
      totalNeto: nominaDetalles.totalNeto,
    })
    .from(nominaDetalles)
    .innerJoin(nominas, eq(nominas.id, nominaDetalles.nominaId))
    .innerJoin(empleados, eq(empleados.id, nominaDetalles.empleadoId))
    .where(eq(nominaDetalles.id, detalleId))
    .limit(1);
  if (!row) return;

  const empresa = await getEmpresaMetadata(row.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const ssNombre = SEGURIDAD_SOCIAL_NOMBRE[pais];
  const semanas = crearSemanasPeriodo(row.periodoInicio, row.periodoFin);
  const salarioPeriodo =
    num(row.totalDevengado) -
    num(row.montoHorasExtra) -
    num(row.bonificaciones) -
    num(row.comisiones);
  const salarioHora = num(row.salarioMensual) / 240;

  semanas.forEach((semana) => {
    if (semana.factor <= 0) return;
    semana.ingresos.push({
      concepto: "Salario",
      monto: salarioPeriodo * semana.factor,
      nota: `${num(row.diasTrabajados).toFixed(2)} dias del periodo`,
    });
    semana.deducciones.push({
      concepto: ssNombre,
      monto: num(row.deduccionSS) * semana.factor,
      nota: "Deduccion fija",
    });
    if (num(row.deduccionRenta) > 0) {
      semana.deducciones.push({
        concepto: "IR",
        monto: num(row.deduccionRenta) * semana.factor,
        nota: "Deduccion fija",
      });
    }
  });

  const asistPeriodo = await db
    .select({ fecha: asistencias.fecha, horasExtra: asistencias.horasExtra })
    .from(asistencias)
    .where(
      and(
        eq(asistencias.empresaId, row.empresaId),
        eq(asistencias.empleadoId, row.empleadoId),
        gte(asistencias.fecha, row.periodoInicio),
        lte(asistencias.fecha, row.periodoFin),
      ),
    );
  const extrasCalculadas = asistPeriodo.reduce((acc, a) => acc + num(a.horasExtra), 0);
  if (extrasCalculadas > 0) {
    for (const asistencia of asistPeriodo) {
      const horas = num(asistencia.horasExtra);
      if (horas <= 0) continue;
      const fecha = fechaMediodia(asistencia.fecha);
      const semana =
        fecha <= semanas[0].fin || semanas[1].factor <= 0 ? semanas[0] : semanas[1];
      semana.ingresos.push({
        concepto: "Horas extra",
        monto: horas * salarioHora * 1.5,
        nota: `${horas.toFixed(2)} horas el ${asistencia.fecha}`,
      });
    }
  } else if (num(row.montoHorasExtra) > 0) {
    agregarVariablePorSemana(
      semanas,
      "periodo",
      {
        concepto: "Horas extra",
        monto: num(row.montoHorasExtra),
        nota: `${num(row.horasExtra).toFixed(2)} horas`,
      },
      "ingresos",
    );
  }

  const [ingresosRows, deduccionesRows] = await Promise.all([
    db
      .select({
        tipo: tiposIngreso.nombre,
        monto: nominaIngresos.monto,
        nota: nominaIngresos.nota,
        semana: nominaIngresos.semana,
      })
      .from(nominaIngresos)
      .innerJoin(tiposIngreso, eq(tiposIngreso.id, nominaIngresos.tipoIngresoId))
      .where(eq(nominaIngresos.nominaDetalleId, detalleId)),
    db
      .select({
        tipo: tiposDeduccion.nombre,
        monto: nominaDeducciones.monto,
        nota: nominaDeducciones.nota,
        semana: nominaDeducciones.semana,
      })
      .from(nominaDeducciones)
      .innerJoin(tiposDeduccion, eq(tiposDeduccion.id, nominaDeducciones.tipoDeduccionId))
      .where(eq(nominaDeducciones.nominaDetalleId, detalleId)),
  ]);

  for (const ingreso of ingresosRows) {
    agregarVariablePorSemana(
      semanas,
      ingreso.semana,
      { concepto: ingreso.tipo, monto: num(ingreso.monto), nota: ingreso.nota },
      "ingresos",
    );
  }
  for (const deduccion of deduccionesRows) {
    agregarVariablePorSemana(
      semanas,
      deduccion.semana,
      { concepto: deduccion.tipo, monto: num(deduccion.monto), nota: deduccion.nota },
      "deducciones",
    );
  }

  const semanasSnapshot = semanas.map((semana) => {
    const totalIngresos = sumarLineas(semana.ingresos);
    const totalDeducciones = sumarLineas(semana.deducciones);
    return {
      clave: semana.clave,
      label: semana.label,
      inicio: semana.inicio.toISOString().slice(0, 10),
      fin: semana.fin.toISOString().slice(0, 10),
      ingresos: semana.ingresos,
      deducciones: semana.deducciones,
      totalIngresos,
      totalDeducciones,
      neto: totalIngresos - totalDeducciones,
    };
  });

  const snapshot = {
    empresa: {
      nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
      identificacionFiscal: empresa?.identificacionFiscal ?? "",
      direccion: empresa?.direccion ?? null,
      telefono: empresa?.telefono ?? null,
      pais,
    },
    periodo: {
      nomina: row.numeroNomina,
      descripcion: row.descripcion,
      frecuencia: row.frecuencia,
      inicio: row.periodoInicio,
      fin: row.periodoFin,
      fechaPago: row.fechaPago,
    },
    empleado: {
      id: row.empleadoId,
      codigo: row.codigo,
      nombre: `${row.nombres} ${row.apellidos}`,
      salarioMensual: num(row.salarioMensual),
      departamento: row.departamento,
      equipo: row.puesto,
      puesto: row.puesto,
    },
    semanas: semanasSnapshot,
    totales: {
      totalIngresos: num(row.totalDevengado),
      totalDeducciones: num(row.totalDeducciones),
      pagoNeto: num(row.totalNeto),
    },
    generadoEn: new Date().toISOString(),
  };

  await db
    .insert(nominaColillas)
    .values({
      empresaId: row.empresaId,
      nominaId: row.nominaId,
      nominaDetalleId: row.detalleId,
      empleadoId: row.empleadoId,
      numero: `COL-${row.numeroNomina}-${row.codigo}`,
      snapshot,
    })
    .onConflictDoUpdate({
      target: nominaColillas.nominaDetalleId,
      set: {
        snapshot,
        actualizadoEn: new Date(),
      },
    });
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
    if (pagar) {
      await guardarColillaDetalle(detalleId);
    }
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

    const detalles = await db
      .select({ id: nominaDetalles.id })
      .from(nominaDetalles)
      .where(eq(nominaDetalles.nominaId, id));
    await Promise.all(detalles.map((detalle) => guardarColillaDetalle(detalle.id)));

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

async function crearVacante(input: unknown): Promise<Resultado> {
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

async function cambiarEstadoVacante(
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

async function crearCandidato(input: unknown): Promise<Resultado> {
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

async function moverEtapaCandidato(
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
async function contratarCandidato(
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
