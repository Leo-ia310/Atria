import { z } from "zod";

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
  rolId: z.string().uuid("Selecciona un rol"),
  activo: z.boolean().default(true),
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const formaPagoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Código requerido")
    .max(10, "Máximo 10 caracteres")
    .regex(/^[A-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  nombre: z.string().trim().min(2, "Nombre requerido").max(60),
  requiereReferencia: z.boolean().default(false),
  cuentaFinancieraId: z.string().uuid().optional().or(z.literal("")),
});
export type FormaPagoInput = z.infer<typeof formaPagoSchema>;

export const perfilSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  telefono: z.string().trim().max(50).optional().or(z.literal("")),
});
export type PerfilInput = z.infer<typeof perfilSchema>;

export const cambiarPasswordSchema = z
  .object({
    actual: z.string().min(1, "Ingresa tu contraseña actual"),
    nueva: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirmar: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

export const rolSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(60),
  descripcion: z.string().trim().max(200).optional().or(z.literal("")),
  permisoIds: z.array(z.string().uuid()).default([]),
});
export type RolInput = z.infer<typeof rolSchema>;

export const cuentaFinancieraSchema = z.object({
  tipo: z.enum(["caja", "banco", "tarjeta", "wallet"]),
  nombre: z.string().trim().min(2, "Nombre requerido").max(80),
  banco: z.string().trim().max(80).optional().or(z.literal("")),
  numeroCuenta: z.string().trim().max(40).optional().or(z.literal("")),
  moneda: z.enum(["HNL", "NIO", "GTQ", "CRC", "USD"]),
  saldoInicial: z.coerce.number().min(0).default(0),
});
export type CuentaFinancieraInput = z.infer<typeof cuentaFinancieraSchema>;

export const secuenciaFiscalSchema = z.object({
  tipoNombre: z.string().trim().min(2, "Nombre del documento requerido").max(60),
  tipoCodigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Código requerido")
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  prefijo: z.string().trim().max(20).optional().or(z.literal("")),
  autorizacion: z.string().trim().max(60).optional().or(z.literal("")),
  rangoInicial: z.coerce.number().int().min(1).optional(),
  rangoFinal: z.coerce.number().int().min(1).optional(),
  fechaLimite: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("")),
});
export type SecuenciaFiscalInput = z.infer<typeof secuenciaFiscalSchema>;

export const impuestoSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(60),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Código requerido")
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  tasa: z.coerce.number().min(0, "No puede ser negativo").max(1, "Usa fracción (ej. 0.15)"),
  esRetencion: z.boolean().default(false),
});
export type ImpuestoInput = z.infer<typeof impuestoSchema>;
