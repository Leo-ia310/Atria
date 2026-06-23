import { z } from "zod";

export const compraItemSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().positive(),
  costoUnitario: z.coerce.number().min(0),
  impuesto: z.coerce.number().min(0).default(0),
});

export const procesarCompraSchema = z.object({
  proveedorId: z.string().uuid(),
  almacenId: z.string().uuid(),
  numeroFactura: z.string().optional().or(z.literal("")),
  fecha: z.string(),
  esCredito: z.boolean().default(false),
  diasCredito: z.coerce.number().int().min(0).default(0),
  cuentaFinancieraId: z.string().uuid().optional().or(z.literal("")),
  items: z.array(compraItemSchema).min(1, "Agrega al menos un producto"),
  notas: z.string().max(500).optional().or(z.literal("")),
});

export type CompraItemInput = z.infer<typeof compraItemSchema>;
export type ProcesarCompraInput = z.infer<typeof procesarCompraSchema>;
