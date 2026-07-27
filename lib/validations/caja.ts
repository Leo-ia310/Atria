import { z } from "zod";

export const crearCajaSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(100),
  codigo: z.string().min(1, "Código requerido").max(20),
});

export const abrirSesionSchema = z.object({
  cajaId: z.string().uuid("Selecciona una caja"),
  montoInicial: z.coerce.number().min(0, "El monto inicial no puede ser negativo"),
});

export const cerrarSesionSchema = z.object({
  sesionId: z.string().uuid(),
  montoFinalReal: z.coerce.number().min(0, "El monto no puede ser negativo"),
  notas: z.string().max(300).optional().or(z.literal("")),
});
