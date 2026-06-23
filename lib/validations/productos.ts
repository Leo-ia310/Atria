import { z } from "zod";

export const productoSchema = z.object({
  sku: z.string().min(1, "SKU requerido").max(50),
  codigoBarras: z.string().max(50).optional().or(z.literal("")),
  nombre: z.string().min(2, "Mínimo 2 caracteres").max(200),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  tipo: z.enum(["simple", "kit", "servicio", "combo"]).default("simple"),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
  marcaId: z.string().uuid().optional().or(z.literal("")),
  unidadBaseId: z.string().uuid().optional().or(z.literal("")),
  impuestoId: z.string().uuid().optional().or(z.literal("")),
  precioBase: z.coerce.number().min(0, "No puede ser negativo"),
  costoPromedio: z.coerce.number().min(0).default(0),
  stockMinimo: z.coerce.number().min(0).default(0),
  stockMaximo: z.coerce.number().min(0).optional(),
  metodoCosteo: z.enum(["promedio", "fifo"]).default("promedio"),
  manejaLotes: z.boolean().default(false),
  manejaSeries: z.boolean().default(false),
});

export type ProductoInput = z.infer<typeof productoSchema>;
