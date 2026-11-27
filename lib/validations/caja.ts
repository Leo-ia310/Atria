import { z } from "zod";

export const crearCajaSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(100),
  codigo: z.string().min(1, "Codigo requerido").max(20),
  sucursalId: z.guid("Selecciona una sucursal"),
});

export const abrirSesionSchema = z.object({
  cajaId: z.guid("Selecciona una caja"),
  montoInicial: z.coerce.number().min(0, "El monto inicial no puede ser negativo"),
});

export const cerrarSesionSchema = z.object({
  attemptId:z.guid().optional(),
  sesionId: z.guid(),
  montoFinalReal: z.coerce.number().min(0, "El monto no puede ser negativo"),
  esperadoLocal: z.coerce.number().finite().optional(),
  notas: z.string().max(300).optional().or(z.literal("")),
});
