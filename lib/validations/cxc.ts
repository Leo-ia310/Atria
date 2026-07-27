import { z } from "zod";

export const registrarAbonoSchema = z.object({
  cxcId: z.string().uuid(),
  formaPagoId: z.string().uuid("Selecciona una forma de pago"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  monto: z.coerce.number().positive("El monto debe ser mayor a cero"),
  referencia: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(300).optional().or(z.literal("")),
});

export type RegistrarAbonoInput = z.infer<typeof registrarAbonoSchema>;
