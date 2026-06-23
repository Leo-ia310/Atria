import { z } from "zod";

export const ventaItemSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva"),
  precioUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0).default(0),
  impuesto: z.coerce.number().min(0).default(0),
  costoUnitario: z.coerce.number().min(0),
});

export const ventaPagoSchema = z.object({
  formaPagoId: z.string().uuid(),
  monto: z.coerce.number().positive(),
  referencia: z.string().optional().or(z.literal("")),
});

export const procesarVentaSchema = z.object({
  sucursalId: z.string().uuid(),
  almacenId: z.string().uuid(),
  clienteId: z.string().uuid().optional().or(z.literal("")),
  items: z.array(ventaItemSchema).min(1, "Agrega al menos un producto"),
  pagos: z.array(ventaPagoSchema).min(1, "Indica al menos un pago"),
  descuentoGlobal: z.coerce.number().min(0).default(0),
  esCredito: z.boolean().default(false),
  diasCredito: z.coerce.number().int().min(0).default(0),
  notas: z.string().max(500).optional().or(z.literal("")),
});

export type VentaItemInput = z.infer<typeof ventaItemSchema>;
export type VentaPagoInput = z.infer<typeof ventaPagoSchema>;
export type ProcesarVentaInput = z.infer<typeof procesarVentaSchema>;
