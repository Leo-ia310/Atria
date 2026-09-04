import { z } from "zod";

const textoLibre = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((valor) => valor.replace(/[<>]/gu, "").replace(/\p{Cc}/gu, ""))
    .optional()
    .or(z.literal(""));

export const restauranteAreaSchema = z.object({
  sucursalId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Nombre requerido").max(80),
});

export const restauranteMesaSchema = z.object({
  sucursalId: z.string().uuid(),
  areaId: z.string().uuid().optional().or(z.literal("")),
  nombre: z.string().trim().min(1, "Mesa requerida").max(40),
  capacidad: z.coerce.number().int().min(1).max(50),
  forma: z.enum(["redonda", "cuadrada", "rectangular", "barra"]).default("rectangular"),
  posX: z.coerce.number().min(0).max(1).default(0.5),
  posY: z.coerce.number().min(0).max(1).default(0.5),
});

export const restauranteMesaEstadoSchema = z.object({
  mesaId: z.string().uuid(),
  estado: z.enum([
    "disponible",
    "ocupada",
    "reservada",
    "por_limpiar",
    "cuenta_solicitada",
    "deshabilitada",
  ]),
});

export const restauranteProductoSchema = z.object({
  productoId: z.string().uuid(),
  tipo: z.enum(["insumo", "producto_directo", "preparacion", "platillo", "combo"]),
  estacionId: z.string().uuid().optional().or(z.literal("")),
  disponibleQr: z.coerce.boolean().default(true),
  consumeInventario: z.coerce.boolean().default(true),
  tiempoPreparacionMin: z.coerce.number().int().min(0).max(360).default(0),
  alergenos: textoLibre(300),
  etiquetas: textoLibre(300),
});

export const restauranteRecetaSchema = z.object({
  productoId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  tipo: z.enum(["preparacion", "platillo", "combo"]).default("platillo"),
  rendimientoCantidad: z.coerce.number().positive("Rendimiento debe ser positivo"),
  rendimientoUnidadId: z.string().uuid().optional().or(z.literal("")),
  precioVenta: z.coerce.number().min(0).default(0),
});

export const restauranteRecetaIngredienteSchema = z.object({
  recetaId: z.string().uuid(),
  ingredienteProductoId: z.string().uuid(),
  unidadId: z.string().uuid().optional().or(z.literal("")),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva"),
  costoUnitario: z.coerce.number().min(0).default(0),
  mermaPct: z.coerce.number().min(0).max(100).default(0),
  notas: textoLibre(200),
});

export const restauranteMermaSchema = z.object({
  sucursalId: z.string().uuid(),
  almacenId: z.string().uuid(),
  productoId: z.string().uuid(),
  unidadId: z.string().uuid().optional().or(z.literal("")),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva"),
  costoUnitario: z.coerce.number().min(0).default(0),
  motivo: z.enum([
    "caducidad",
    "preparacion",
    "accidente",
    "desperdicio",
    "devolucion",
    "cortesia",
    "otro",
  ]),
  observacion: textoLibre(500),
});

export const restauranteOrdenSchema = z.object({
  sucursalId: z.string().uuid(),
  mesaId: z.string().uuid().optional().or(z.literal("")),
  canal: z
    .enum([
      "salon",
      "qr_mesa",
      "para_llevar",
      "delivery_propio",
      "delivery_externo",
      "pedido_web",
    ])
    .default("salon"),
  personas: z.coerce.number().int().min(1).max(80).default(1),
  notas: textoLibre(500),
  idempotencyKey: z.string().trim().max(120).optional().or(z.literal("")),
});

export const restauranteOrdenItemSchema = z.object({
  ordenId: z.string().uuid(),
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().positive("Cantidad debe ser positiva").max(100),
  precioUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0).default(0),
  impuesto: z.coerce.number().min(0).default(0),
  costoUnitario: z.coerce.number().min(0).default(0),
  notasCocina: textoLibre(500),
});

export const restauranteEnviarComandaSchema = z.object({
  ordenId: z.string().uuid(),
});

export const restauranteSolicitarCuentaSchema = z.object({
  ordenId: z.string().uuid(),
});

export const restauranteMoverMesaOrdenSchema = z.object({
  ordenId: z.string().uuid(),
  mesaId: z.string().uuid("Selecciona una mesa"),
});

export const restauranteCobroOrdenSchema = z.object({
  ordenId: z.string().uuid(),
  formaPagoId: z.string().uuid("Selecciona una forma de pago"),
  referencia: textoLibre(120),
  propina: z.coerce.number().min(0).max(1000000).default(0),
  montoRecibido: z.coerce.number().min(0).max(1000000).optional(),
  idempotencyKey: z.string().trim().max(120).optional().or(z.literal("")),
});

export const restauranteMesaLimpiaSchema = z.object({
  mesaId: z.string().uuid(),
});

export const restauranteComandaEstadoSchema = z.object({
  comandaId: z.string().uuid(),
  estado: z.enum(["recibida", "preparando", "lista", "entregada", "cancelada"]),
});

export const restauranteReservacionSchema = z.object({
  sucursalId: z.string().uuid(),
  mesaId: z.string().uuid().optional().or(z.literal("")),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  telefono: textoLibre(50),
  email: z.string().trim().email("Correo no valido").optional().or(z.literal("")),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora invalida"),
  personas: z.coerce.number().int().min(1).max(80),
  ocasionEspecial: textoLibre(120),
  notas: textoLibre(500),
});

export const restauranteEsperaSchema = z.object({
  sucursalId: z.string().uuid(),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  telefono: textoLibre(50),
  personas: z.coerce.number().int().min(1).max(80),
  esperaEstimadaMin: z.coerce.number().int().min(0).max(600).optional(),
  preferencia: textoLibre(120),
  notas: textoLibre(500),
});

export const restauranteComensalPublicoSchema = z.object({
  slug: z.string().trim().min(3).max(80),
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  telefono: textoLibre(50),
  email: z.string().trim().email("Correo no valido").optional().or(z.literal("")),
  cumpleanos: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
    .optional()
    .or(z.literal("")),
  primeraVisita: textoLibre(20),
  comoNosConocio: textoLibre(120),
  alergias: textoLibre(300),
  comidaFavorita: textoLibre(120),
});

export const restauranteComensalManualSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  telefono: textoLibre(50),
  email: z.string().trim().email("Correo no valido").optional().or(z.literal("")),
  cumpleanos: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
    .optional()
    .or(z.literal("")),
  preferencias: textoLibre(300),
  alergias: textoLibre(300),
  ocasionesEspeciales: textoLibre(200),
  notas: textoLibre(500),
});

export const restaurantePromocionSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(120),
  descripcion: textoLibre(300),
  tipo: z.enum(["porcentaje", "monto", "precio_fijo", "dos_por_uno"]),
  valor: z.coerce.number().min(0).default(0),
  productoId: z.string().uuid().optional().or(z.literal("")),
  categoriaId: z.string().uuid().optional().or(z.literal("")),
  diasSemana: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  fechaFin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  activa: z.coerce.boolean().default(true),
});

export type RestauranteAreaInput = z.infer<typeof restauranteAreaSchema>;
export type RestauranteMesaInput = z.infer<typeof restauranteMesaSchema>;
export type RestauranteProductoInput = z.infer<typeof restauranteProductoSchema>;
export type RestauranteRecetaInput = z.infer<typeof restauranteRecetaSchema>;
export type RestauranteRecetaIngredienteInput =
  z.infer<typeof restauranteRecetaIngredienteSchema>;
export type RestauranteOrdenInput = z.infer<typeof restauranteOrdenSchema>;
export type RestauranteOrdenItemInput = z.infer<typeof restauranteOrdenItemSchema>;
export type RestauranteCobroOrdenInput = z.infer<typeof restauranteCobroOrdenSchema>;
export type RestauranteMoverMesaOrdenInput = z.infer<typeof restauranteMoverMesaOrdenSchema>;
export type RestauranteComensalManualInput =
  z.infer<typeof restauranteComensalManualSchema>;
export type RestaurantePromocionInput = z.infer<typeof restaurantePromocionSchema>;
