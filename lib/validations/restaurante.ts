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
  sucursalId: z.string().uuid().optional().or(z.literal("")),
  cantidadMesas: z.coerce.number().int().min(0).max(200).default(0),
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
  productoId: z.string().uuid().optional().or(z.literal("")),
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

export const menuPlatilloDesdeProductoSchema = z.object({
  menuId: z.string().uuid(),
  productoId: z.string().uuid("Selecciona un producto"),
  seccionId: z.string().uuid().optional().or(z.literal("")),
  destacado: z.coerce.boolean().default(false),
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

export const pedidoMenuPublicoSchema = z.object({
  slug: z.string().trim().min(3).max(80),
  mesaNumero: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9A-Za-z-]*$/, "Mesa invalida")
    .optional()
    .or(z.literal("")),
  clienteNombre: z.string().trim().max(120).optional().or(z.literal("")),
  clienteTelefono: z.string().trim().max(50).optional().or(z.literal("")),
  clienteDireccion: z.string().trim().max(220).optional().or(z.literal("")),
  notas: z.string().trim().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        platilloId: z.string().uuid(),
        cantidad: z.coerce.number().int().min(1).max(50),
      }),
    )
    .min(1, "Agrega al menos un platillo"),
}).superRefine((data, ctx) => {
  if (data.mesaNumero) return;
  if (!data.clienteNombre || data.clienteNombre.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clienteNombre"],
      message: "Nombre requerido",
    });
  }
  if (!data.clienteTelefono || data.clienteTelefono.length < 6) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clienteTelefono"],
      message: "Telefono requerido",
    });
  }
});

export type MenuVirtualInput = z.infer<typeof menuVirtualSchema>;
export type MenuVirtualAjustesInput = z.infer<typeof menuVirtualAjustesSchema>;
export type MenuSeccionInput = z.infer<typeof menuSeccionSchema>;
export type MenuPlatilloInput = z.infer<typeof menuPlatilloSchema>;
export type MenuPlatilloDesdeProductoInput = z.infer<typeof menuPlatilloDesdeProductoSchema>;
export type MenuPromocionInput = z.infer<typeof menuPromocionSchema>;
