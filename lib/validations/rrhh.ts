import { z } from "zod";

const opt = (max: number) => z.string().max(max).optional().or(z.literal(""));

function edadEnAnios(isoFecha: string, ref: Date): number {
  const nac = new Date(isoFecha + "T00:00:00");
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
  return edad;
}

export const empleadoSchema = z
  .object({
    nombres: z.string().min(2, "Mínimo 2 caracteres").max(120),
    apellidos: z.string().min(2, "Mínimo 2 caracteres").max(120),
    identificacion: opt(50),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Correo no válido")
      .optional()
      .or(z.literal("")),
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
  })
  .superRefine((d, ctx) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (d.fechaNacimiento && d.fechaNacimiento !== "") {
      const nac = new Date(d.fechaNacimiento + "T00:00:00");
      if (Number.isNaN(nac.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fecha de nacimiento inválida",
          path: ["fechaNacimiento"],
        });
      } else if (nac > hoy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de nacimiento no puede ser futura",
          path: ["fechaNacimiento"],
        });
      } else if (edadEnAnios(d.fechaNacimiento, hoy) < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El empleado debe ser mayor de 16 años",
          path: ["fechaNacimiento"],
        });
      } else if (edadEnAnios(d.fechaNacimiento, hoy) > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Verifica la fecha de nacimiento",
          path: ["fechaNacimiento"],
        });
      }
    }

    if (d.fechaIngreso) {
      const ing = new Date(d.fechaIngreso + "T00:00:00");
      if (
        d.fechaNacimiento &&
        d.fechaNacimiento !== "" &&
        !Number.isNaN(ing.getTime()) &&
        ing <= new Date(d.fechaNacimiento + "T00:00:00")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El ingreso debe ser posterior al nacimiento",
          path: ["fechaIngreso"],
        });
      }
    }
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
  )
  .refine(
    (d) =>
      !d.fechaInicio ||
      !d.fechaFin ||
      d.fechaInicio === "" ||
      d.fechaFin === "" ||
      d.fechaFin >= d.fechaInicio,
    { message: "La fecha fin no puede ser anterior a la de inicio", path: ["fechaFin"] },
  );
export type SolicitudInput = z.infer<typeof solicitudSchema>;

export const feriadoSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(120),
  fecha: z.string().min(8, "Fecha requerida"),
  esNacional: z.boolean().default(true),
  esRecurrente: z.boolean().default(true),
});
export type FeriadoInput = z.infer<typeof feriadoSchema>;

export const actualizarFeriadoSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(120),
  fecha: z.string().min(8, "Fecha requerida"),
});
export type ActualizarFeriadoInput = z.infer<typeof actualizarFeriadoSchema>;

export const nominaGenerarSchema = z.object({
  descripcion: z.string().min(3, "Describe la nómina").max(160),
  frecuencia: z.enum(["semanal", "quincenal", "mensual"]),
  periodoInicio: z.string().min(8, "Fecha requerida"),
  periodoFin: z.string().min(8, "Fecha requerida"),
  fechaPago: z.string().min(8, "Fecha requerida"),
});
export type NominaGenerarInput = z.infer<typeof nominaGenerarSchema>;

export const vacanteSchema = z
  .object({
    titulo: z.string().trim().min(2, "Título requerido").max(160),
    departamento: opt(120),
    descripcion: opt(2000),
    requisitos: opt(2000),
    habilidades: z
      .array(z.string().trim().min(1).max(60))
      .max(30, "Máximo 30 habilidades")
      .optional()
      .default([]),
    experienciaAnios: z.coerce
      .number()
      .int("Debe ser un número entero")
      .min(0, "No puede ser negativo")
      .max(60, "Valor fuera de rango")
      .optional(),
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
  })
  .refine(
    (d) =>
      d.salarioMin === undefined ||
      d.salarioMax === undefined ||
      d.salarioMax >= d.salarioMin,
    { message: "El salario máximo debe ser mayor o igual al mínimo", path: ["salarioMax"] },
  );
export type VacanteInput = z.infer<typeof vacanteSchema>;

export const candidatoSchema = z
  .object({
    vacanteId: z.string().uuid("Vacante inválida"),
    nombres: z.string().trim().min(2, "Nombre requerido").max(120),
    apellidos: z.string().trim().min(2, "Apellido requerido").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Correo no válido")
      .optional()
      .or(z.literal("")),
    telefono: opt(50),
    fuente: opt(80),
    expectativaSalarial: z.coerce
      .number()
      .min(0, "No puede ser negativo")
      .max(100_000_000, "Monto fuera de rango")
      .optional(),
    notas: opt(1000),
  })
  .superRefine((d, ctx) => {
    const tieneEmail = !!d.email && d.email !== "";
    const tieneTel = !!d.telefono && d.telefono !== "";
    if (!tieneEmail && !tieneTel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica al menos un correo o teléfono de contacto",
        path: ["email"],
      });
    }
    if (tieneTel) {
      const digitos = (d.telefono as string).replace(/\D/g, "");
      if (digitos.length < 7) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Teléfono inválido (mínimo 7 dígitos)",
          path: ["telefono"],
        });
      }
    }
  });
export type CandidatoInput = z.infer<typeof candidatoSchema>;
