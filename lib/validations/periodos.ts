import { z } from "zod";

export const crearPeriodoSchema = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

export const periodoIdSchema = z.object({
  periodoId: z.string().uuid(),
});
