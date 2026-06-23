import { z } from "zod";

export const proveedorSchema = z.object({
  razonSocial: z.string().min(2).max(200),
  nombreComercial: z.string().max(200).optional().or(z.literal("")),
  identificacionFiscal: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  telefono: z.string().max(50).optional().or(z.literal("")),
  direccion: z.string().max(300).optional().or(z.literal("")),
  diasCredito: z.coerce.number().int().min(0).default(0),
  contacto: z.string().max(200).optional().or(z.literal("")),
  notas: z.string().max(500).optional().or(z.literal("")),
});

export type ProveedorInput = z.infer<typeof proveedorSchema>;
