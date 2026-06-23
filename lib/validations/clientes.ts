import { z } from "zod";

export const clienteSchema = z.object({
  nombre: z.string().min(2, "Mínimo 2 caracteres").max(200),
  identificacionFiscal: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  telefono: z.string().max(50).optional().or(z.literal("")),
  direccion: z.string().max(300).optional().or(z.literal("")),
  limiteCredito: z.coerce.number().min(0).default(0),
  diasCredito: z.coerce.number().int().min(0).default(0),
  esConsumidorFinal: z.boolean().default(false),
  notas: z.string().max(500).optional().or(z.literal("")),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
