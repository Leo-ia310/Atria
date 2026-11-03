import { z } from "zod";
export const selfServiceSchema = z
  .object({
    action: z.enum(["read", "profile", "password", "support"]),
    input: z.record(z.unknown()).optional(),
  })
  .strict();
export type SelfServiceCommand = z.infer<typeof selfServiceSchema>;
export const selfProfileSchema = z.object({
  nombre: z.string(),
  email: z.string(),
  telefono: z.string(),
  rol: z.string().nullable(),
  empresa: z.string(),
  planNombre: z.string(),
  preguntasDiarias: z.number().nullable(),
  palabrasPorPregunta: z.number().nullable(),
});
export type SelfProfile = z.infer<typeof selfProfileSchema>;
export const selfServiceResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    profile: selfProfileSchema.optional(),
    respuesta: z.string().optional(),
    modulos: z
      .array(
        z.object({ modulo: z.string(), label: z.string(), href: z.string() }),
      )
      .optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    tipo: z.enum(["warning", "error"]).optional(),
  }),
]);
export type SelfServiceResult = z.infer<typeof selfServiceResultSchema>;
