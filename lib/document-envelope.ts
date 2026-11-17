import { z } from "zod";
/** Versioned data envelope, not an authorization to issue fiscal documents. No external fiscal client. */
export const documentEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    clase: z.enum([
      "cotizacion",
      "proforma",
      "comprobante_interno",
      "documento_fiscal",
    ]),
    emisor: z.object({
      nombre: z.string().min(1),
      nombreComercial: z.string().nullable(),
      ruc: z.string().nullable(),
      direccion: z.string().nullable(),
      email: z.string().nullable(),
      telefono: z.string().nullable(),
      sucursalId: z.string().uuid(),
    }),
    comprador: z
      .object({ nombre: z.string(), identificacion: z.string().nullable() })
      .nullable(),
    serie: z.string().nullable(),
    numero: z.string().min(1),
    fecha: z.string(),
    ejemplar: z.enum(["original", "duplicado"]),
    lineas: z
      .array(
        z.object({
          descripcion: z.string(),
          cantidad: z.number().positive(),
          precioUnitario: z.number().min(0),
          subtotal: z.number().min(0),
          descuento: z.number().min(0),
          iva: z.number().min(0),
          exento: z.boolean(),
          motivoExencion: z.string().nullable(),
        }),
      )
      .min(1),
    total: z.number().min(0),
    anulado: z.boolean(),
    reimpresionDe: z.string().uuid().nullable(),
    autorizacion: z
      .object({
        identificador: z.string(),
        mecanismo: z.string(),
        pie: z.string(),
        evidenciaId: z.string().uuid(),
      })
      .nullable(),
    branding: z.object({
      logoUrl: z.string().nullable(),
      encabezado: z.string().max(2000),
      pieComercial: z.string().max(4000),
      redes: z.array(z.string().max(300)).max(10),
      observaciones: z.string().max(4000),
    }),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.clase === "documento_fiscal")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emisión fiscal no implementada en esta etapa.",
      });
    if (d.clase !== "documento_fiscal" && d.autorizacion)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Un documento comercial/interno no admite autorización fiscal.",
      });
    if (d.lineas.some((l) => l.exento && !l.motivoExencion?.trim()))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La exención requiere motivo.",
      });
  });
export type DocumentEnvelope = z.infer<typeof documentEnvelopeSchema>;
export const protectedFiscalFields = [
  "emisor.nombre",
  "emisor.ruc",
  "emisor.direccion",
  "emisor.sucursalId",
  "serie",
  "numero",
  "fecha",
  "comprador",
  "lineas",
  "total",
  "ejemplar",
  "autorizacion",
] as const;
