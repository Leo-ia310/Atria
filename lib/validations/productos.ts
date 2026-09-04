import { z } from "zod";

export const productoSchema = z
  .object({
    sku: z.string().trim().max(50).optional().or(z.literal("")),
    codigoBarras: z.string().max(50).optional().or(z.literal("")),
    nombre: z.string().min(2, "Mínimo 2 caracteres").max(200),
    descripcion: z.string().max(500).optional().or(z.literal("")),
    tipo: z.enum(["simple", "kit", "servicio", "combo"]).default("simple"),
    categoriaId: z.string().uuid().optional().or(z.literal("")),
    marcaId: z.string().uuid().optional().or(z.literal("")),
    unidadBaseId: z.string().uuid().optional().or(z.literal("")),
    impuestoId: z.string().uuid().optional().or(z.literal("")),
    productoFiscalCodigo: z.string().trim().min(1).max(80).default("GENERAL_TAXABLE"),
    precioBase: z.coerce.number().min(0, "No puede ser negativo"),
    costoPromedio: z.coerce.number().min(0).default(0),
    stockMinimo: z.coerce.number().min(0).default(0),
    stockMaximo: z.coerce.number().min(0).optional(),
    metodoCosteo: z.enum(["promedio", "fifo"]).default("promedio"),
    manejaLotes: z.boolean().default(false),
    manejaSeries: z.boolean().default(false),
    fechaVencimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (d) =>
      d.stockMaximo == null ||
      d.stockMaximo === 0 ||
      d.stockMinimo <= d.stockMaximo,
    {
      message: "El stock mínimo no puede ser mayor que el stock máximo",
      path: ["stockMaximo"],
    },
  );

export const crearMarcaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(80),
});

export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(80),
});

export const productoImportadoSchema = z.object({
  fila: z.coerce.number().int().min(1),
  sku: z.string().trim().min(1, "SKU requerido").max(50),
  codigoBarras: z.string().trim().max(50).optional().or(z.literal("")),
  nombre: z.string().trim().min(1, "Nombre requerido").max(200),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  precioBase: z.coerce.number().min(0).default(0),
  costoPromedio: z.coerce.number().min(0).default(0),
  stockMinimo: z.coerce.number().min(0).default(0),
  stockMaximo: z.coerce.number().min(0).optional(),
  existenciaInicial: z.coerce.number().min(0).default(0),
  advertencias: z
    .array(
      z.object({
        campo: z.string().trim().min(1).max(60),
        mensaje: z.string().trim().min(1).max(240),
        valorOriginal: z.string().trim().max(240).optional(),
      }),
    )
    .default([]),
});

export const importarProductosSchema = z.object({
  filas: z.array(productoImportadoSchema).min(1, "No hay productos validos").max(1000),
});

export const entradaInventarioLectorSchema = z.object({
  productoId: z.string().uuid("Producto invalido"),
  almacenId: z.string().uuid("Almacen invalido"),
  codigoBarras: z.string().trim().min(1, "Codigo de barras requerido").max(80),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que cero"),
  fechaVencimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
    .optional()
    .or(z.literal("")),
  precioBase: z.coerce.number().min(0, "El precio no puede ser negativo"),
  costoPromedio: z.coerce.number().min(0, "El costo no puede ser negativo"),
});

export type ProductoInput = z.infer<typeof productoSchema>;
export type ProductoImportadoInput = z.infer<typeof productoImportadoSchema>;
export type ImportarProductosInput = z.infer<typeof importarProductosSchema>;
export type EntradaInventarioLectorInput = z.infer<
  typeof entradaInventarioLectorSchema
>;
