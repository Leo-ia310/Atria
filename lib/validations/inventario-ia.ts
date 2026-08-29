import { z } from "zod";

export const asistenteProductoTextoSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(3, "Escribe que producto quieres crear")
    .max(3000, "El texto es muy largo. Resume la descripcion de los productos."),
});

export const propuestaProductoSchema = z.object({
  nombre: z.string().trim().min(2, "El producto necesita un nombre").max(200),
  sku: z.string().trim().max(50).optional().or(z.literal("")),
  codigoBarras: z.string().trim().max(50).optional().or(z.literal("")),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  precioBase: z.coerce.number().min(0, "El precio no puede ser negativo").default(0),
  costoPromedio: z.coerce.number().min(0, "El costo no puede ser negativo").default(0),
  stockMinimo: z.coerce.number().min(0).default(0),
  existenciaInicial: z.coerce.number().min(0).default(0),
});

export const propuestasProductoIASchema = z.object({
  productos: z.array(propuestaProductoSchema).max(30).default([]),
  preguntas: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
  nota: z.string().trim().max(240).default(""),
});

export const crearProductosDesdeAsistenteSchema = z.object({
  productos: z
    .array(propuestaProductoSchema)
    .min(1, "Agrega al menos un producto")
    .max(30, "Puedes crear hasta 30 productos por tanda"),
});

const filaProblematicaSchema = z.object({
  fila: z.coerce.number().int().min(1),
  celdas: z.array(z.string().trim().max(240)).max(40),
  interpretacion: z.object({
    sku: z.string().trim().max(50).default(""),
    codigoBarras: z.string().trim().max(50).default(""),
    nombre: z.string().trim().max(200).default(""),
    descripcion: z.string().trim().max(500).default(""),
    precioBase: z.coerce.number().default(0),
    costoPromedio: z.coerce.number().default(0),
    stockMinimo: z.coerce.number().default(0),
    stockMaximo: z.coerce.number().optional(),
    existenciaInicial: z.coerce.number().default(0),
  }),
  problemas: z.array(z.string().trim().max(240)).max(10).default([]),
});

export const supervisarImportacionSchema = z.object({
  filas: z.array(filaProblematicaSchema).min(1, "No hay filas para revisar").max(80),
});

export type AsistenteProductoTextoInput = z.infer<typeof asistenteProductoTextoSchema>;
export type PropuestaProducto = z.infer<typeof propuestaProductoSchema>;
export type PropuestasProductoIA = z.infer<typeof propuestasProductoIASchema>;
export type CrearProductosDesdeAsistenteInput = z.infer<
  typeof crearProductosDesdeAsistenteSchema
>;
export type FilaProblematica = z.infer<typeof filaProblematicaSchema>;
export type SupervisarImportacionInput = z.infer<typeof supervisarImportacionSchema>;
