import { z } from "zod";
export const designColumns = [
  "producto",
  "cantidad",
  "precio",
  "descuento",
  "impuesto",
  "total",
] as const;
function readableColor(value: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05) >= 4.5;
}
export const documentDesignSchema = z
  .object({
    format: z.enum(["carta", "media-carta", "termico80"]).default("carta"),
    font: z.enum(["Arial", "Times New Roman", "Courier New"]).default("Arial"),
    fontSize: z.number().int().min(8).max(18).default(12),
    margin: z.number().int().min(12).max(120).default(32),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .refine(
        readableColor,
        "El color debe conservar contraste legible sobre fondo blanco.",
      )
      .default("#6d28d9"),
    alignment: z.enum(["left", "center", "right"]).default("left"),
    header: z.string().max(1000).default(""),
    footer: z.string().max(2000).default(""),
    columns: z
      .array(z.enum(designColumns))
      .length(6)
      .refine(
        (v) => new Set(v).size === 6,
        "Conserva todas las columnas obligatorias.",
      )
      .default([...designColumns]),
    widths: z
      .array(z.number().min(5).max(70))
      .length(6)
      .refine(
        (v) => Math.abs(v.reduce((a, b) => a + b, 0) - 100) < 0.01,
        "Los anchos deben sumar 100%.",
      )
      .default([42, 10, 14, 10, 10, 14]),
    logoData: z
      .string()
      .max(280000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.format === "termico80" && d.margin > 45)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El margen térmico máximo es de 12 mm.",
      });
    if (
      /autorizad[oa]\s+por\s+(?:la\s+)?DGI|factura\s+fiscal\s+autorizada/i.test(
        d.header + " " + d.footer,
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No se pueden declarar autorizaciones fiscales.",
      });
  });
export type DocumentDesign = z.infer<typeof documentDesignSchema>;
export function documentImageSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0;
  if (
    bytes.length > 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes.length > 10 && bytes[0] === 255 && bytes[1] === 216) {
    for (let at = 2; at + 8 < bytes.length;) {
      if (bytes[at] !== 255) {
        at++;
        continue;
      }
      const marker = bytes[at + 1],
        length = view.getUint16(at + 2);
      if ([192, 193, 194].includes(marker)) {
        height = view.getUint16(at + 5);
        width = view.getUint16(at + 7);
        break;
      }
      if (length < 2) break;
      at += length + 2;
    }
  }
  if (!width || !height)
    throw new Error("Solo se admiten imágenes PNG/JPEG raster válidas.");
  return { width, height };
}
export const defaultDocumentDesign = documentDesignSchema.parse({});
export const documentCommandSchema = z
  .object({
    action: z.enum([
      "templates",
      "createTemplate",
      "saveTemplate",
      "duplicateTemplate",
      "issue",
      "read",
      "print",
      "recover",
    ]),
    requestId: z.string().uuid(),
    sucursalId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    design: documentDesignSchema.optional(),
    expectedVersion: z.number().int().positive().optional(),
    templateId: z.string().uuid().optional(),
    templateVersion: z.number().int().positive().optional(),
    sourceKind: z
      .enum([
        "cotizacion",
        "proforma",
        "factura",
        "venta",
        "nota_credito",
        "recibo",
        "estado_cuenta",
      ])
      .optional(),
    sourceId: z.string().uuid().optional(),
    sourceVersion: z.number().int().positive().optional(),
    ejemplar: z.enum(["original", "duplicado"]).default("original"),
    attemptId: z.string().uuid().optional(),
  })
  .strict();
export type DocumentCommand = z.infer<typeof documentCommandSchema>;
export type TemplateDto = {
  id: string;
  name: string;
  version: number;
  versions: Array<{ version: number; design: DocumentDesign | null }>;
};
export type DocumentIssue = {
  id: string;
  sourceKind: string;
  sourceId: string;
  sourceVersion: number;
  numero: string;
  ejemplar: "original" | "duplicado";
  version: number;
  design: DocumentDesign;
  snapshot: import("./commercial-pdf").PrintableDocument;
  events: Array<{ accion: string; usuario: string; fecha: string }>;
};
export type DocumentResult =
  | {
      ok: true;
      cached?: boolean;
      permissions?: string[];
      templates?: TemplateDto[];
      template?: TemplateDto;
      issue?: DocumentIssue;
      discarded?: boolean;
    }
  | { ok: false; error: string };
