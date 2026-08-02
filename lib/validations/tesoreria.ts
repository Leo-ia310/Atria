import { z } from "zod";

export const crearCuentaFinancieraSchema = z.object({
  tipo: z.enum(["caja", "banco", "tarjeta", "wallet"]),
  nombre: z.string().min(1, "Nombre requerido").max(100),
  banco: z.string().max(100).optional().or(z.literal("")),
  numeroCuenta: z.string().max(50).optional().or(z.literal("")),
  moneda: z.enum(["HNL", "NIO", "GTQ", "CRC", "USD"]),
  saldoInicial: z.coerce.number().min(0).default(0),
  cuentaContableId: z.string().uuid().optional().or(z.literal("")),
});

export const crearCategoriaGastoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  cuentaContableId: z.string().uuid("Cuenta contable requerida"),
});

export const crearGastoSchema = z.object({
  categoriaId: z.string().uuid("Selecciona una categoría"),
  cuentaFinancieraId: z.string().uuid("Selecciona cuenta de pago"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  referencia: z.string().max(100).optional().or(z.literal("")),
  subtotal: z.coerce.number().positive("El monto debe ser mayor a cero"),
  impuesto: z.coerce.number().min(0).default(0),
  recurrenteMensual: z.boolean().default(false),
});

export const actualizarGastoRecurrenteSchema = z.object({
  id: z.string().uuid(),
  categoriaId: z.string().uuid("Selecciona una categoría"),
  cuentaFinancieraId: z.string().uuid("Selecciona cuenta de pago"),
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  referencia: z.string().max(100).optional().or(z.literal("")),
  subtotal: z.coerce.number().positive("El monto debe ser mayor a cero"),
  impuesto: z.coerce.number().min(0).default(0),
  diaMes: z.coerce.number().int().min(1).max(31),
  proximaFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  activa: z.boolean(),
});

export type CrearGastoInput = z.infer<typeof crearGastoSchema>;
export type ActualizarGastoRecurrenteInput = z.infer<typeof actualizarGastoRecurrenteSchema>;
export type CrearCuentaFinancieraInput = z.infer<typeof crearCuentaFinancieraSchema>;
