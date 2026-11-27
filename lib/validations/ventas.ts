import { z } from "zod";
import { manualPaymentEvidenceSchema } from "../pos-payment";
import { posMoney } from "../pos-money";

export const ventaItemSchema = z.object({
  productoId: z.guid(),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva"),
  precioUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().finite().min(0).default(0).transform(posMoney),
  impuesto: z.coerce.number().finite().min(0).default(0).transform(posMoney),
  costoUnitario: z.coerce.number().min(0),
});

export const ventaPagoSchema = manualPaymentEvidenceSchema.extend({
  formaPagoId: z.guid(),
  monto: z.coerce.number().finite().positive().transform(posMoney).pipe(z.number().positive("El pago debe ser al menos de un centavo.")),
  referencia: z.string().optional().or(z.literal("")),
});

export const procesarVentaSchema = z.object({
  sucursalId: z.guid(),
  sesionCajaId: z.guid().optional(),
  almacenId: z.guid(),
  clienteId: z.guid().optional().or(z.literal("")),
  items: z.array(ventaItemSchema).min(1, "Agrega al menos un producto"),
  pagos: z.array(ventaPagoSchema),
  descuentoGlobal: z.coerce.number().finite().min(0).default(0).transform(posMoney),
  esCredito: z.boolean().default(false),
  diasCredito: z.coerce.number().int().min(0).default(0),
  notas: z.string().max(500).optional().or(z.literal("")),
}).refine((data) => data.esCredito || data.pagos.length > 0, { message: "Indica al menos un pago", path: ["pagos"] });

export type VentaItemInput = z.infer<typeof ventaItemSchema>;
export type VentaPagoInput = z.infer<typeof ventaPagoSchema>;
export type ProcesarVentaInput = z.infer<typeof procesarVentaSchema>;
