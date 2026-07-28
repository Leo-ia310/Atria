import { z } from "zod";

const opt = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const empleadoSchema = z.object({
  nombres: z.string().min(2, "Mínimo 2 caracteres").max(120),
  apellidos: z.string().min(2, "Mínimo 2 caracteres").max(120),
  identificacion: opt(50),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  telefono: opt(50),
  direccion: opt(300),
  fechaNacimiento: opt(20),
  genero: z.enum(["masculino", "femenino", "otro", ""]).optional(),
  puesto: z.string().min(2, "Indica el puesto").max(120),
  departamento: opt(120),
  tipoContrato: z.enum([
    "indefinido",
    "temporal",
    "por_obra",
    "medio_tiempo",
    "practicante",
    "servicios",
  ]),
  fechaIngreso: z.string().min(8, "Fecha de ingreso requerida"),
  salarioBase: z.coerce.number().min(0, "No puede ser negativo").default(0),
  frecuenciaPago: z.enum(["semanal", "quincenal", "mensual"]),
  diasVacacionesAnuales: z.coerce.number().int().min(0).max(60).default(12),
  sucursalId: opt(40),
  banco: opt(80),
  cuentaBanco: opt(60),
  contactoEmergenciaNombre: opt(120),
  contactoEmergenciaTelefono: opt(50),
  notas: opt(500),
});
export type EmpleadoInput = z.infer<typeof empleadoSchema>;

export const asistenciaSchema = z.object({
  empleadoId: z.string().uuid("Empleado inválido"),
  fecha: z.string().min(8, "Fecha requerida"),
  estado: z.enum([
    "presente",
    "tarde",
    "ausente",
    "justificado",
    "permiso",
    "vacaciones",
    "incapacidad",
    "feriado",
    "descanso",
  ]),
  horasTrabajadas: z.coerce.number().min(0).max(24).default(8),
  horasExtra: z.coerce.number().min(0).max(24).default(0),
  notas: opt(300),
});
export type AsistenciaInput = z.infer<typeof asistenciaSchema>;

export const solicitudSchema = z
  .object({
    empleadoId: z.string().uuid("Empleado inválido"),
    tipo: z.enum(["vacaciones", "permiso", "incapacidad", "adelanto", "constancia", "otro"]),
    fechaInicio: opt(20),
    fechaFin: opt(20),
    monto: z.coerce.number().min(0).optional(),
    motivo: z.string().min(3, "Describe el motivo").max(500),
  })
  .refine(
    (d) => d.tipo !== "adelanto" || (d.monto ?? 0) > 0,
    { message: "Indica el monto del adelanto", path: ["monto"] },
  );
export type SolicitudInput = z.infer<typeof solicitudSchema>;

export const feriadoSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(120),
  fecha: z.string().min(8, "Fecha requerida"),
  esNacional: z.boolean().default(true),
  esRecurrente: z.boolean().default(true),
});
export type FeriadoInput = z.infer<typeof feriadoSchema>;

export const nominaGenerarSchema = z.object({
  descripcion: z.string().min(3, "Describe la nómina").max(160),
  frecuencia: z.enum(["semanal", "quincenal", "mensual"]),
  periodoInicio: z.string().min(8, "Fecha requerida"),
  periodoFin: z.string().min(8, "Fecha requerida"),
  fechaPago: z.string().min(8, "Fecha requerida"),
});
export type NominaGenerarInput = z.infer<typeof nominaGenerarSchema>;

export const vacanteSchema = z.object({
  titulo: z.string().min(2, "Título requerido").max(160),
  departamento: opt(120),
  descripcion: opt(2000),
  requisitos: opt(2000),
  tipoContrato: z.enum([
    "indefinido",
    "temporal",
    "por_obra",
    "medio_tiempo",
    "practicante",
    "servicios",
  ]),
  salarioMin: z.coerce.number().min(0).optional(),
  salarioMax: z.coerce.number().min(0).optional(),
  plazas: z.coerce.number().int().min(1).max(999).default(1),
  sucursalId: opt(40),
});
export type VacanteInput = z.infer<typeof vacanteSchema>;

export const candidatoSchema = z.object({
  vacanteId: z.string().uuid("Vacante inválida"),
  nombres: z.string().min(2, "Nombre requerido").max(120),
  apellidos: z.string().min(2, "Apellido requerido").max(120),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  telefono: opt(50),
  fuente: opt(80),
  expectativaSalarial: z.coerce.number().min(0).optional(),
  notas: opt(1000),
});
export type CandidatoInput = z.infer<typeof candidatoSchema>;
