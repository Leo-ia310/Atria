import { z } from "zod";

export const registrarPagoSchema = z.object({
  cxpId: z.string().uuid(),
  cuentaFinancieraId: z.string().uuid("Selecciona una cuenta"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  monto: z.coerce.number().positive("El monto debe ser mayor a cero"),
  referencia: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(300).optional().or(z.literal("")),
});
