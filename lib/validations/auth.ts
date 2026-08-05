import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo no válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registroEmpresaSchema = z.object({
  razonSocial: z.string().min(2, "Mínimo 2 caracteres").max(200),
  nombreComercial: z.string().max(200).optional().or(z.literal("")),
  identificacionFiscal: z.string().min(3, "Identificación fiscal requerida").max(50),
  tipoEmpresa: z.enum(["general", "restaurante", "retail", "servicios"]).default("general"),
  pais: z.enum(["HN", "NI", "GT", "CR", "SV"]),
  moneda: z.enum(["HNL", "NIO", "GTQ", "CRC", "USD"]),
});

export const registroAdminSchema = z
  .object({
    nombre: z.string().min(2, "Mínimo 2 caracteres").max(100),
    email: z.string().email("Correo no válido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir una mayúscula")
      .regex(/[0-9]/, "Debe incluir un número"),
    confirmarPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const registroPlanSchema = z.object({
  planId: z.enum(["demo", "pro", "enterprise"]),
  ciclo: z.enum(["mensual", "anual"]).default("mensual"),
});

export const registroCompletoSchema = z.object({
  empresa: registroEmpresaSchema,
  admin: registroAdminSchema,
  plan: registroPlanSchema,
  aceptaTerminos: z.literal(true, {
    errorMap: () => ({
      message:
        "Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.",
    }),
  }),
});

export type RegistroEmpresaInput = z.infer<typeof registroEmpresaSchema>;
export type RegistroAdminInput = z.infer<typeof registroAdminSchema>;
export type RegistroPlanInput = z.infer<typeof registroPlanSchema>;
export type RegistroCompletoInput = z.infer<typeof registroCompletoSchema>;
