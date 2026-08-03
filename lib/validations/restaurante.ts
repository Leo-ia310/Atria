import { z } from "zod";

const urlOpcional = z
  .string()
  .trim()
  .url("URL no valida")
  .optional()
  .or(z.literal(""));

const textoOpcional = z.string().trim().optional().or(z.literal(""));

export const menuVirtualSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  slug: z
    .string()
    .trim()
    .min(3, "Minimo 3 caracteres")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa solo letras, numeros y guiones"),
  descripcion: textoOpcional,
  plantilla: z.enum(["bistro", "minimal", "fiesta"]).default("bistro"),
});

export const menuVirtualAjustesSchema = z.object({
  menuId: z.string().uuid(),
  nombre: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa solo letras, numeros y guiones"),
  descripcion: textoOpcional,
  plantilla: z.enum(["bistro", "minimal", "fiesta"]).default("bistro"),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color invalido"),
  colorSecundario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color invalido"),
  colorFondo: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color invalido"),
  logoUrl: urlOpcional,
  telefono: textoOpcional,
  whatsapp: textoOpcional,
  instagramUrl: urlOpcional,
  facebookUrl: urlOpcional,
  tiktokUrl: urlOpcional,
  sitioWebUrl: urlOpcional,
  animaciones: z.coerce.boolean().default(false),
  publicado: z.coerce.boolean().default(false),
});

export const menuSeccionSchema = z.object({
  menuId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Nombre requerido").max(80),
  descripcion: textoOpcional,
});

export const menuPlatilloSchema = z.object({
  menuId: z.string().uuid(),
  seccionId: z.string().uuid().optional().or(z.literal("")),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  descripcion: textoOpcional,
  precio: z.coerce.number().positive("Precio debe ser mayor que cero"),
  precioOferta: z.coerce.number().positive().optional().or(z.literal("")),
  etiquetaOferta: textoOpcional,
  imagenUrl: urlOpcional,
  destacado: z.coerce.boolean().default(false),
  disponible: z.coerce.boolean().default(true),
});

export const menuPromocionSchema = z.object({
  menuId: z.string().uuid(),
  platilloId: z.string().uuid().optional().or(z.literal("")),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  descripcion: textoOpcional,
  tipo: z.enum(["porcentaje", "monto", "precio_fijo"]),
  valor: z.coerce.number().positive("Valor debe ser mayor que cero"),
  diasSemana: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Selecciona al menos un dia"),
  fechaInicio: z.string().optional().or(z.literal("")),
  fechaFin: z.string().optional().or(z.literal("")),
});

export const pedidoCocinaEstadoSchema = z.object({
  pedidoId: z.string().uuid(),
  estado: z.enum(["nuevo", "en_preparacion", "listo", "entregado", "cancelado"]),
});

export type MenuVirtualInput = z.infer<typeof menuVirtualSchema>;
export type MenuVirtualAjustesInput = z.infer<typeof menuVirtualAjustesSchema>;
export type MenuSeccionInput = z.infer<typeof menuSeccionSchema>;
export type MenuPlatilloInput = z.infer<typeof menuPlatilloSchema>;
export type MenuPromocionInput = z.infer<typeof menuPromocionSchema>;
