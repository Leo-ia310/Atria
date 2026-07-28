/**
 * ATRIA — Schema completo (Drizzle ORM + PostgreSQL)
 *
 * Convenciones:
 *   - Toda tabla de negocio incluye empresa_id (multi-tenant).
 *   - Dinero: numeric(18, 4). Nunca float.
 *   - IDs: uuid.
 *   - Soft delete: eliminado_en (nullable timestamp).
 *   - Movimientos de inventario y partidas contables son APPEND-ONLY.
 *
 * RLS: las policies se aplican via SQL post-migration (ver lib/db/policies.sql).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  pgEnum,
  jsonb,
  date,
  unique,
  index,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* =========================================================
 * ENUMS
 * ========================================================= */

export const planTipoEnum = pgEnum("plan_tipo", ["demo", "pro", "enterprise"]);
export const cicloFacturacionEnum = pgEnum("ciclo_facturacion", ["mensual", "anual"]);
export const suscripcionEstadoEnum = pgEnum("suscripcion_estado", [
  "activa",
  "trial",
  "vencida",
  "cancelada",
  "suspendida",
]);
export const paisEnum = pgEnum("pais", ["HN", "NI", "GT", "CR", "SV"]);
export const monedaEnum = pgEnum("moneda", ["HNL", "NIO", "GTQ", "CRC", "USD"]);

export const productoTipoEnum = pgEnum("producto_tipo", [
  "simple",
  "kit",
  "servicio",
  "combo",
]);
export const metodoCosteoEnum = pgEnum("metodo_costeo", ["promedio", "fifo"]);
export const movInvTipoEnum = pgEnum("movimiento_inventario_tipo", [
  "entrada_compra",
  "salida_venta",
  "ajuste_entrada",
  "ajuste_salida",
  "transferencia_entrada",
  "transferencia_salida",
  "devolucion_cliente",
  "devolucion_proveedor",
  "merma",
  "conteo_diferencia",
]);

export const ventaEstadoEnum = pgEnum("venta_estado", [
  "completada",
  "anulada",
  "pendiente",
]);
export const cotizacionEstadoEnum = pgEnum("cotizacion_estado", [
  "borrador",
  "enviada",
  "aceptada",
  "rechazada",
  "convertida",
  "vencida",
]);

export const compraEstadoEnum = pgEnum("compra_estado", [
  "borrador",
  "recibida",
  "parcial",
  "anulada",
]);
export const ocEstadoEnum = pgEnum("orden_compra_estado", [
  "borrador",
  "enviada",
  "parcial",
  "recibida",
  "cancelada",
]);

export const cxcEstadoEnum = pgEnum("cxc_estado", [
  "pendiente",
  "parcial",
  "pagada",
  "vencida",
  "incobrable",
]);
export const cxpEstadoEnum = pgEnum("cxp_estado", [
  "pendiente",
  "parcial",
  "pagada",
  "vencida",
]);

export const cuentaTipoEnum = pgEnum("cuenta_contable_tipo", [
  "activo",
  "pasivo",
  "patrimonio",
  "ingreso",
  "costo",
  "gasto",
  "orden",
]);
export const cuentaNaturalezaEnum = pgEnum("cuenta_naturaleza", ["deudora", "acreedora"]);
export const asientoOrigenEnum = pgEnum("asiento_origen", [
  "venta",
  "compra",
  "pago_cliente",
  "pago_proveedor",
  "gasto",
  "ajuste_inventario",
  "cierre_caja",
  "apertura_caja",
  "depreciacion",
  "nomina",
  "manual",
  "cierre_periodo",
]);
export const asientoEstadoEnum = pgEnum("asiento_estado", [
  "borrador",
  "registrado",
  "anulado",
]);

export const periodoEstadoEnum = pgEnum("periodo_estado", ["abierto", "cerrado"]);
export const sesionCajaEstadoEnum = pgEnum("sesion_caja_estado", ["abierta", "cerrada"]);

export const cuentaFinTipoEnum = pgEnum("cuenta_financiera_tipo", [
  "caja",
  "banco",
  "tarjeta",
  "wallet",
]);
export const movTesoreriaTipoEnum = pgEnum("movimiento_tesoreria_tipo", [
  "ingreso",
  "egreso",
  "transferencia",
]);

export const documentoFiscalEstadoEnum = pgEnum("documento_fiscal_estado", [
  "emitido",
  "anulado",
]);

/* =========================================================
 * MÓDULO 1 — NÚCLEO SAAS
 * ========================================================= */

export const planes = pgTable("planes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  tipo: planTipoEnum("tipo").notNull(),
  precioMensual: numeric("precio_mensual", { precision: 10, scale: 2 }).notNull(),
  precioAnual: numeric("precio_anual", { precision: 10, scale: 2 }).notNull(),
  maxSucursales: integer("max_sucursales"),
  maxUsuarios: integer("max_usuarios"),
  maxProductos: integer("max_productos"),
  maxTransaccionesMes: integer("max_transacciones_mes"),
  precioUsuarioExtra: numeric("precio_usuario_extra", { precision: 10, scale: 2 }),
  precioSucursalExtra: numeric("precio_sucursal_extra", { precision: 10, scale: 2 }),
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const empresas = pgTable(
  "empresas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    razonSocial: text("razon_social").notNull(),
    nombreComercial: text("nombre_comercial"),
    identificacionFiscal: text("identificacion_fiscal").notNull(),
    pais: paisEnum("pais").notNull(),
    moneda: monedaEnum("moneda").notNull(),
    telefono: text("telefono"),
    email: text("email"),
    direccion: text("direccion"),
    logoUrl: text("logo_url"),
    zonaHoraria: text("zona_horaria").notNull().default("America/Managua"),
    formatoFecha: text("formato_fecha").notNull().default("DD/MM/YYYY"),
    activa: boolean("activa").notNull().default(true),
    onboardingCompleto: boolean("onboarding_completo").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("empresas_pais_idx").on(t.pais)],
);

export const suscripciones = pgTable(
  "suscripciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => planes.id),
    estado: suscripcionEstadoEnum("estado").notNull().default("trial"),
    ciclo: cicloFacturacionEnum("ciclo").notNull().default("mensual"),
    usuariosExtra: integer("usuarios_extra").notNull().default(0),
    sucursalesExtra: integer("sucursales_extra").notNull().default(0),
    inicioPeriodo: timestamp("inicio_periodo", { withTimezone: true }).notNull(),
    finPeriodo: timestamp("fin_periodo", { withTimezone: true }).notNull(),
    canceladaEn: timestamp("cancelada_en", { withTimezone: true }),
    notas: text("notas"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suscripciones_empresa_idx").on(t.empresaId)],
);

export const sucursales = pgTable(
  "sucursales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    telefono: text("telefono"),
    esPrincipal: boolean("es_principal").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    unique("sucursales_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("sucursales_empresa_idx").on(t.empresaId),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    esBase: boolean("es_base").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("roles_empresa_nombre_uq").on(t.empresaId, t.nombre),
    index("roles_empresa_idx").on(t.empresaId),
  ],
);

export const permisos = pgTable("permisos", {
  id: uuid("id").primaryKey().defaultRandom(),
  clave: text("clave").notNull().unique(),
  modulo: text("modulo").notNull(),
  descripcion: text("descripcion"),
});

export const rolPermisos = pgTable(
  "rol_permisos",
  {
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permisoId: uuid("permiso_id")
      .notNull()
      .references(() => permisos.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.rolId, t.permisoId] })],
);

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    rolId: uuid("rol_id").references(() => roles.id),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    telefono: text("telefono"),
    avatarUrl: text("avatar_url"),
    activo: boolean("activo").notNull().default(true),
    esSuperAdmin: boolean("es_super_admin").notNull().default(false),
    ultimoLogin: timestamp("ultimo_login", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    unique("usuarios_empresa_email_uq").on(t.empresaId, t.email),
    index("usuarios_empresa_idx").on(t.empresaId),
    index("usuarios_email_idx").on(t.email),
  ],
);

export const usuarioSucursales = pgTable(
  "usuario_sucursales",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.sucursalId] })],
);

export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    accion: text("accion").notNull(),
    tabla: text("tabla").notNull(),
    registroId: text("registro_id"),
    datosAntes: jsonb("datos_antes"),
    datosDespues: jsonb("datos_despues"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auditoria_empresa_idx").on(t.empresaId),
    index("auditoria_tabla_registro_idx").on(t.tabla, t.registroId),
    index("auditoria_creado_idx").on(t.creadoEn),
  ],
);

export const configuraciones = pgTable(
  "configuraciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    clave: text("clave").notNull(),
    valor: jsonb("valor").notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("configuraciones_empresa_clave_uq").on(t.empresaId, t.clave),
    index("configuraciones_empresa_idx").on(t.empresaId),
  ],
);

export const tiposCambio = pgTable(
  "tipos_cambio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    monedaOrigen: monedaEnum("moneda_origen").notNull(),
    monedaDestino: monedaEnum("moneda_destino").notNull(),
    tasa: numeric("tasa", { precision: 18, scale: 8 }).notNull(),
    fecha: date("fecha").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tipos_cambio_uq").on(t.empresaId, t.monedaOrigen, t.monedaDestino, t.fecha),
    index("tipos_cambio_empresa_idx").on(t.empresaId),
  ],
);

/* =========================================================
 * MÓDULO 2 — CATÁLOGO E INVENTARIO
 * ========================================================= */

export const categorias = pgTable(
  "categorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    padreId: uuid("padre_id"),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categorias_empresa_idx").on(t.empresaId)],
);

export const marcas = pgTable(
  "marcas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("marcas_empresa_nombre_uq").on(t.empresaId, t.nombre),
    index("marcas_empresa_idx").on(t.empresaId),
  ],
);

export const unidadesMedida = pgTable(
  "unidades_medida",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    esBase: boolean("es_base").notNull().default(false),
  },
  (t) => [
    unique("unidades_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("unidades_empresa_idx").on(t.empresaId),
  ],
);

export const impuestos = pgTable(
  "impuestos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    codigo: text("codigo").notNull(),
    tasa: numeric("tasa", { precision: 6, scale: 4 }).notNull(),
    esRetencion: boolean("es_retencion").notNull().default(false),
    cuentaContableId: uuid("cuenta_contable_id"),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    unique("impuestos_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("impuestos_empresa_idx").on(t.empresaId),
  ],
);

export const productos = pgTable(
  "productos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    codigoBarras: text("codigo_barras"),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    tipo: productoTipoEnum("tipo").notNull().default("simple"),
    categoriaId: uuid("categoria_id").references(() => categorias.id),
    marcaId: uuid("marca_id").references(() => marcas.id),
    unidadBaseId: uuid("unidad_base_id").references(() => unidadesMedida.id),
    impuestoId: uuid("impuesto_id").references(() => impuestos.id),
    precioBase: numeric("precio_base", { precision: 18, scale: 4 }).notNull().default("0"),
    costoPromedio: numeric("costo_promedio", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    stockMinimo: numeric("stock_minimo", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    stockMaximo: numeric("stock_maximo", { precision: 18, scale: 4 }),
    metodoCosteo: metodoCosteoEnum("metodo_costeo").notNull().default("promedio"),
    manejaLotes: boolean("maneja_lotes").notNull().default(false),
    manejaSeries: boolean("maneja_series").notNull().default(false),
    fechaVencimiento: date("fecha_vencimiento"),
    imagenUrl: text("imagen_url"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    unique("productos_empresa_sku_uq").on(t.empresaId, t.sku),
    index("productos_empresa_idx").on(t.empresaId),
    index("productos_nombre_idx").on(t.nombre),
    index("productos_codigo_barras_idx").on(t.codigoBarras),
  ],
);

export const productoUnidades = pgTable(
  "producto_unidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    unidadId: uuid("unidad_id")
      .notNull()
      .references(() => unidadesMedida.id),
    factor: numeric("factor", { precision: 18, scale: 4 }).notNull(),
    esVenta: boolean("es_venta").notNull().default(true),
    esCompra: boolean("es_compra").notNull().default(true),
  },
  (t) => [
    unique("producto_unidad_uq").on(t.productoId, t.unidadId),
    index("producto_unidades_producto_idx").on(t.productoId),
  ],
);

export const productoComponentes = pgTable(
  "producto_componentes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoPadreId: uuid("producto_padre_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    componenteId: uuid("componente_id")
      .notNull()
      .references(() => productos.id, { onDelete: "restrict" }),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("componentes_padre_idx").on(t.productoPadreId)],
);

export const listasPrecios = pgTable(
  "listas_precios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    esDefault: boolean("es_default").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [index("listas_precios_empresa_idx").on(t.empresaId)],
);

export const precios = pgTable(
  "precios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listaId: uuid("lista_id")
      .notNull()
      .references(() => listasPrecios.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    precio: numeric("precio", { precision: 18, scale: 4 }).notNull(),
    vigenteDesde: date("vigente_desde"),
    vigenteHasta: date("vigente_hasta"),
  },
  (t) => [
    unique("precios_lista_producto_uq").on(t.listaId, t.productoId),
    index("precios_producto_idx").on(t.productoId),
  ],
);

export const almacenes = pgTable(
  "almacenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    esPrincipal: boolean("es_principal").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [
    unique("almacenes_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("almacenes_empresa_idx").on(t.empresaId),
  ],
);

export const lotes = pgTable(
  "lotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "restrict" }),
    numero: text("numero").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    fechaFabricacion: date("fecha_fabricacion"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("lotes_producto_numero_uq").on(t.productoId, t.numero),
    index("lotes_empresa_idx").on(t.empresaId),
    index("lotes_vencimiento_idx").on(t.fechaVencimiento),
  ],
);

export const existencias = pgTable(
  "existencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    almacenId: uuid("almacen_id")
      .notNull()
      .references(() => almacenes.id, { onDelete: "cascade" }),
    loteId: uuid("lote_id").references(() => lotes.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull().default("0"),
    cantidadReservada: numeric("cantidad_reservada", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("existencias_uq").on(t.productoId, t.almacenId, t.loteId),
    index("existencias_empresa_idx").on(t.empresaId),
    index("existencias_almacen_idx").on(t.almacenId),
  ],
);

/**
 * APPEND-ONLY. Fuente de verdad de stock. Nunca UPDATE/DELETE.
 * Para corregir un movimiento mal hecho, registrar un contramovimiento.
 */
export const movimientosInventario = pgTable(
  "movimientos_inventario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "restrict" }),
    almacenId: uuid("almacen_id")
      .notNull()
      .references(() => almacenes.id, { onDelete: "restrict" }),
    loteId: uuid("lote_id").references(() => lotes.id),
    tipo: movInvTipoEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    costoUnitario: numeric("costo_unitario", { precision: 18, scale: 4 }).notNull(),
    referenciaTabla: text("referencia_tabla"),
    referenciaId: uuid("referencia_id"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mov_inv_empresa_idx").on(t.empresaId),
    index("mov_inv_producto_idx").on(t.productoId),
    index("mov_inv_almacen_idx").on(t.almacenId),
    index("mov_inv_referencia_idx").on(t.referenciaTabla, t.referenciaId),
    index("mov_inv_creado_idx").on(t.creadoEn),
  ],
);

export const conteosInventario = pgTable(
  "conteos_inventario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    almacenId: uuid("almacen_id")
      .notNull()
      .references(() => almacenes.id),
    fecha: date("fecha").notNull(),
    estado: text("estado").notNull().default("en_progreso"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    aplicadoEn: timestamp("aplicado_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conteos_empresa_idx").on(t.empresaId)],
);

export const conteoDetalle = pgTable(
  "conteo_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conteoId: uuid("conteo_id")
      .notNull()
      .references(() => conteosInventario.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    cantidadEsperada: numeric("cantidad_esperada", { precision: 18, scale: 4 }).notNull(),
    cantidadFisica: numeric("cantidad_fisica", { precision: 18, scale: 4 }),
    diferencia: numeric("diferencia", { precision: 18, scale: 4 }),
  },
  (t) => [index("conteo_detalle_conteo_idx").on(t.conteoId)],
);

/* =========================================================
 * MÓDULO 3 — COMPRAS Y PROVEEDORES
 * ========================================================= */

export const proveedores = pgTable(
  "proveedores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    razonSocial: text("razon_social").notNull(),
    nombreComercial: text("nombre_comercial"),
    identificacionFiscal: text("identificacion_fiscal"),
    email: text("email"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    diasCredito: integer("dias_credito").notNull().default(0),
    contacto: text("contacto"),
    notas: text("notas"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    index("proveedores_empresa_idx").on(t.empresaId),
    index("proveedores_razon_idx").on(t.razonSocial),
  ],
);

export const ordenesCompra = pgTable(
  "ordenes_compra",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    proveedorId: uuid("proveedor_id")
      .notNull()
      .references(() => proveedores.id),
    numero: text("numero").notNull(),
    fecha: date("fecha").notNull(),
    fechaEsperada: date("fecha_esperada"),
    estado: ocEstadoEnum("estado").notNull().default("borrador"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull().default("0"),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull().default("0"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("oc_empresa_numero_uq").on(t.empresaId, t.numero),
    index("oc_empresa_idx").on(t.empresaId),
  ],
);

export const ordenCompraDetalle = pgTable(
  "orden_compra_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ordenId: uuid("orden_id")
      .notNull()
      .references(() => ordenesCompra.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    cantidadRecibida: numeric("cantidad_recibida", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    costoUnitario: numeric("costo_unitario", { precision: 18, scale: 4 }).notNull(),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("oc_detalle_orden_idx").on(t.ordenId)],
);

export const compras = pgTable(
  "compras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    almacenId: uuid("almacen_id")
      .notNull()
      .references(() => almacenes.id),
    proveedorId: uuid("proveedor_id")
      .notNull()
      .references(() => proveedores.id),
    ordenId: uuid("orden_id").references(() => ordenesCompra.id),
    numeroFactura: text("numero_factura"),
    fecha: date("fecha").notNull(),
    estado: compraEstadoEnum("estado").notNull().default("recibida"),
    esCredito: boolean("es_credito").notNull().default(false),
    diasCredito: integer("dias_credito").notNull().default(0),
    fechaVencimiento: date("fecha_vencimiento"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    retencion: numeric("retencion", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    asientoId: uuid("asiento_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  },
  (t) => [
    index("compras_empresa_idx").on(t.empresaId),
    index("compras_proveedor_idx").on(t.proveedorId),
    index("compras_fecha_idx").on(t.fecha),
  ],
);

export const compraDetalle = pgTable(
  "compra_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compraId: uuid("compra_id")
      .notNull()
      .references(() => compras.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    loteId: uuid("lote_id").references(() => lotes.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    costoUnitario: numeric("costo_unitario", { precision: 18, scale: 4 }).notNull(),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("compra_detalle_compra_idx").on(t.compraId)],
);

export const cuentasPorPagar = pgTable(
  "cuentas_por_pagar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    proveedorId: uuid("proveedor_id")
      .notNull()
      .references(() => proveedores.id),
    compraId: uuid("compra_id").references(() => compras.id),
    fechaEmision: date("fecha_emision").notNull(),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    saldo: numeric("saldo", { precision: 18, scale: 4 }).notNull(),
    estado: cxpEstadoEnum("estado").notNull().default("pendiente"),
    notas: text("notas"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cxp_empresa_idx").on(t.empresaId),
    index("cxp_proveedor_idx").on(t.proveedorId),
    index("cxp_vencimiento_idx").on(t.fechaVencimiento),
  ],
);

export const pagosProveedor = pgTable(
  "pagos_proveedor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    cxpId: uuid("cxp_id")
      .notNull()
      .references(() => cuentasPorPagar.id),
    cuentaFinancieraId: uuid("cuenta_financiera_id"),
    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    referencia: text("referencia"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    asientoId: uuid("asiento_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pagos_prov_empresa_idx").on(t.empresaId),
    index("pagos_prov_cxp_idx").on(t.cxpId),
  ],
);

/* =========================================================
 * MÓDULO 4 — VENTAS / POS / CLIENTES
 * ========================================================= */

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    identificacionFiscal: text("identificacion_fiscal"),
    email: text("email"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    limiteCredito: numeric("limite_credito", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    diasCredito: integer("dias_credito").notNull().default(0),
    listaPrecioId: uuid("lista_precio_id").references(() => listasPrecios.id),
    esConsumidorFinal: boolean("es_consumidor_final").notNull().default(false),
    notas: text("notas"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    index("clientes_empresa_idx").on(t.empresaId),
    index("clientes_nombre_idx").on(t.nombre),
  ],
);

export const cajas = pgTable(
  "cajas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    cuentaFinancieraId: uuid("cuenta_financiera_id"),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [
    unique("cajas_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("cajas_empresa_idx").on(t.empresaId),
  ],
);

export const sesionesCaja = pgTable(
  "sesiones_caja",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    cajaId: uuid("caja_id")
      .notNull()
      .references(() => cajas.id),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    estado: sesionCajaEstadoEnum("estado").notNull().default("abierta"),
    montoInicial: numeric("monto_inicial", { precision: 18, scale: 4 }).notNull(),
    montoFinalEsperado: numeric("monto_final_esperado", { precision: 18, scale: 4 }),
    montoFinalReal: numeric("monto_final_real", { precision: 18, scale: 4 }),
    diferencia: numeric("diferencia", { precision: 18, scale: 4 }),
    abiertaEn: timestamp("abierta_en", { withTimezone: true }).notNull().defaultNow(),
    cerradaEn: timestamp("cerrada_en", { withTimezone: true }),
    notas: text("notas"),
  },
  (t) => [
    index("sesiones_empresa_idx").on(t.empresaId),
    index("sesiones_caja_idx").on(t.cajaId),
  ],
);

export const formasPago = pgTable(
  "formas_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    cuentaFinancieraId: uuid("cuenta_financiera_id"),
    requiereReferencia: boolean("requiere_referencia").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [
    unique("formas_pago_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("formas_pago_empresa_idx").on(t.empresaId),
  ],
);

export const ventas = pgTable(
  "ventas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    sesionCajaId: uuid("sesion_caja_id").references(() => sesionesCaja.id),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    numero: text("numero").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    estado: ventaEstadoEnum("estado").notNull().default("completada"),
    esCredito: boolean("es_credito").notNull().default(false),
    diasCredito: integer("dias_credito").notNull().default(0),
    fechaVencimiento: date("fecha_vencimiento"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
    descuento: numeric("descuento", { precision: 18, scale: 4 }).notNull().default("0"),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    costoTotal: numeric("costo_total", { precision: 18, scale: 4 }).notNull().default("0"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    asientoId: uuid("asiento_id"),
    documentoFiscalId: uuid("documento_fiscal_id"),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    motivoAnulacion: text("motivo_anulacion"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("ventas_empresa_numero_uq").on(t.empresaId, t.numero),
    index("ventas_empresa_idx").on(t.empresaId),
    index("ventas_cliente_idx").on(t.clienteId),
    index("ventas_fecha_idx").on(t.fecha),
    index("ventas_sucursal_idx").on(t.sucursalId),
  ],
);

export const ventaDetalle = pgTable(
  "venta_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    loteId: uuid("lote_id").references(() => lotes.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    precioUnitario: numeric("precio_unitario", { precision: 18, scale: 4 }).notNull(),
    descuento: numeric("descuento", { precision: 18, scale: 4 }).notNull().default("0"),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    costoUnitario: numeric("costo_unitario", { precision: 18, scale: 4 }).notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("venta_detalle_venta_idx").on(t.ventaId)],
);

export const pagosVenta = pgTable(
  "pagos_venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id, { onDelete: "cascade" }),
    formaPagoId: uuid("forma_pago_id")
      .notNull()
      .references(() => formasPago.id),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    referencia: text("referencia"),
    cambio: numeric("cambio", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => [index("pagos_venta_venta_idx").on(t.ventaId)],
);

export const notasCredito = pgTable(
  "notas_credito",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id),
    numero: text("numero").notNull(),
    fecha: date("fecha").notNull(),
    motivo: text("motivo").notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    asientoId: uuid("asiento_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("nc_empresa_numero_uq").on(t.empresaId, t.numero),
    index("nc_empresa_idx").on(t.empresaId),
  ],
);

export const notaCreditoDetalle = pgTable(
  "nota_credito_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notaId: uuid("nota_id")
      .notNull()
      .references(() => notasCredito.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    precioUnitario: numeric("precio_unitario", { precision: 18, scale: 4 }).notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("nc_detalle_nota_idx").on(t.notaId)],
);

// Repositorio de facturas emitidas. Guarda un snapshot JSON de la venta para
// reconstruir el documento desde una plantilla y filtrar sin joins pesados.
export const facturas = pgTable(
  "facturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id, { onDelete: "cascade" }),
    numero: text("numero").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    vendedorId: uuid("vendedor_id").references(() => usuarios.id),
    vendedorNombre: text("vendedor_nombre"),
    clienteNombre: text("cliente_nombre"),
    formasPago: text("formas_pago"),
    esCredito: boolean("es_credito").notNull().default(false),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    snapshot: jsonb("snapshot").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("facturas_venta_uq").on(t.ventaId),
    index("facturas_empresa_idx").on(t.empresaId),
    index("facturas_fecha_idx").on(t.fecha),
    index("facturas_vendedor_idx").on(t.vendedorId),
  ],
);

export const cuentasPorCobrar = pgTable(
  "cuentas_por_cobrar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    ventaId: uuid("venta_id").references(() => ventas.id),
    fechaEmision: date("fecha_emision").notNull(),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    saldo: numeric("saldo", { precision: 18, scale: 4 }).notNull(),
    estado: cxcEstadoEnum("estado").notNull().default("pendiente"),
    notas: text("notas"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cxc_empresa_idx").on(t.empresaId),
    index("cxc_cliente_idx").on(t.clienteId),
    index("cxc_vencimiento_idx").on(t.fechaVencimiento),
  ],
);

export const abonosCliente = pgTable(
  "abonos_cliente",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    cxcId: uuid("cxc_id")
      .notNull()
      .references(() => cuentasPorCobrar.id),
    formaPagoId: uuid("forma_pago_id")
      .notNull()
      .references(() => formasPago.id),
    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    referencia: text("referencia"),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    asientoId: uuid("asiento_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("abonos_empresa_idx").on(t.empresaId),
    index("abonos_cxc_idx").on(t.cxcId),
  ],
);

export const cotizaciones = pgTable(
  "cotizaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    numero: text("numero").notNull(),
    fecha: date("fecha").notNull(),
    vigenteHasta: date("vigente_hasta"),
    estado: cotizacionEstadoEnum("estado").notNull().default("borrador"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
    descuento: numeric("descuento", { precision: 18, scale: 4 }).notNull().default("0"),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    ventaId: uuid("venta_id").references(() => ventas.id),
    notas: text("notas"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("cotizaciones_empresa_numero_uq").on(t.empresaId, t.numero),
    index("cotizaciones_empresa_idx").on(t.empresaId),
  ],
);

export const cotizacionDetalle = pgTable(
  "cotizacion_detalle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cotizacionId: uuid("cotizacion_id")
      .notNull()
      .references(() => cotizaciones.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 18, scale: 4 }).notNull(),
    precioUnitario: numeric("precio_unitario", { precision: 18, scale: 4 }).notNull(),
    descuento: numeric("descuento", { precision: 18, scale: 4 }).notNull().default("0"),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [index("cotizacion_detalle_cot_idx").on(t.cotizacionId)],
);

/* =========================================================
 * MÓDULO 5 — FACTURACIÓN FISCAL
 * ========================================================= */

export const tiposDocumento = pgTable(
  "tipos_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    aplicaA: text("aplica_a").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [unique("tipos_doc_empresa_codigo_uq").on(t.empresaId, t.codigo)],
);

export const secuenciasFiscales = pgTable(
  "secuencias_fiscales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    tipoDocumentoId: uuid("tipo_documento_id")
      .notNull()
      .references(() => tiposDocumento.id),
    prefijo: text("prefijo"),
    siguienteNumero: integer("siguiente_numero").notNull().default(1),
    rangoInicial: integer("rango_inicial"),
    rangoFinal: integer("rango_final"),
    autorizacion: text("autorizacion"),
    fechaLimite: date("fecha_limite"),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [index("secuencias_empresa_idx").on(t.empresaId)],
);

export const documentosFiscales = pgTable(
  "documentos_fiscales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    secuenciaId: uuid("secuencia_id")
      .notNull()
      .references(() => secuenciasFiscales.id),
    tipoDocumentoId: uuid("tipo_documento_id")
      .notNull()
      .references(() => tiposDocumento.id),
    numero: text("numero").notNull(),
    referenciaTabla: text("referencia_tabla").notNull(),
    referenciaId: uuid("referencia_id").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    estado: documentoFiscalEstadoEnum("estado").notNull().default("emitido"),
    autorizacion: text("autorizacion"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    unique("doc_fiscal_numero_uq").on(t.empresaId, t.numero),
    index("doc_fiscal_empresa_idx").on(t.empresaId),
    index("doc_fiscal_referencia_idx").on(t.referenciaTabla, t.referenciaId),
  ],
);

/* =========================================================
 * MÓDULO 6 — CONTABILIDAD
 * ========================================================= */

export const catalogoCuentas = pgTable(
  "catalogo_cuentas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    padreId: uuid("padre_id"),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipo: cuentaTipoEnum("tipo").notNull(),
    naturaleza: cuentaNaturalezaEnum("naturaleza").notNull(),
    nivel: integer("nivel").notNull().default(1),
    esDetalle: boolean("es_detalle").notNull().default(true),
    permiteMovimiento: boolean("permite_movimiento").notNull().default(true),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("cuentas_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("cuentas_empresa_idx").on(t.empresaId),
    index("cuentas_padre_idx").on(t.padreId),
  ],
);

export const centrosCosto = pgTable(
  "centros_costo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [unique("cc_empresa_codigo_uq").on(t.empresaId, t.codigo)],
);

export const periodosContables = pgTable(
  "periodos_contables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin").notNull(),
    estado: periodoEstadoEnum("estado").notNull().default("abierto"),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    cerradoPor: uuid("cerrado_por").references(() => usuarios.id),
  },
  (t) => [
    unique("periodo_empresa_anio_mes_uq").on(t.empresaId, t.anio, t.mes),
    index("periodos_empresa_idx").on(t.empresaId),
  ],
);

export const asientosContables = pgTable(
  "asientos_contables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    periodoId: uuid("periodo_id")
      .notNull()
      .references(() => periodosContables.id),
    numero: text("numero").notNull(),
    fecha: date("fecha").notNull(),
    concepto: text("concepto").notNull(),
    origen: asientoOrigenEnum("origen").notNull(),
    referenciaTabla: text("referencia_tabla"),
    referenciaId: uuid("referencia_id"),
    totalDebe: numeric("total_debe", { precision: 18, scale: 4 }).notNull(),
    totalHaber: numeric("total_haber", { precision: 18, scale: 4 }).notNull(),
    estado: asientoEstadoEnum("estado").notNull().default("registrado"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    motivoAnulacion: text("motivo_anulacion"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("asientos_empresa_numero_uq").on(t.empresaId, t.numero),
    index("asientos_empresa_idx").on(t.empresaId),
    index("asientos_periodo_idx").on(t.periodoId),
    index("asientos_fecha_idx").on(t.fecha),
    index("asientos_referencia_idx").on(t.referenciaTabla, t.referenciaId),
  ],
);

/**
 * APPEND-ONLY. Las partidas de un asiento son inmutables.
 * Para corregir un asiento se anula y se crea uno nuevo.
 */
export const asientoPartidas = pgTable(
  "asiento_partidas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    asientoId: uuid("asiento_id")
      .notNull()
      .references(() => asientosContables.id, { onDelete: "cascade" }),
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => catalogoCuentas.id),
    centroCostoId: uuid("centro_costo_id").references(() => centrosCosto.id),
    descripcion: text("descripcion"),
    debe: numeric("debe", { precision: 18, scale: 4 }).notNull().default("0"),
    haber: numeric("haber", { precision: 18, scale: 4 }).notNull().default("0"),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [
    index("partidas_asiento_idx").on(t.asientoId),
    index("partidas_cuenta_idx").on(t.cuentaId),
  ],
);

/* =========================================================
 * MÓDULO 7 — TESORERÍA
 * ========================================================= */

export const cuentasFinancieras = pgTable(
  "cuentas_financieras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    tipo: cuentaFinTipoEnum("tipo").notNull(),
    nombre: text("nombre").notNull(),
    banco: text("banco"),
    numeroCuenta: text("numero_cuenta"),
    moneda: monedaEnum("moneda").notNull(),
    saldoActual: numeric("saldo_actual", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    cuentaContableId: uuid("cuenta_contable_id").references(() => catalogoCuentas.id),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cuentas_fin_empresa_idx").on(t.empresaId)],
);

export const movimientosTesoreria = pgTable(
  "movimientos_tesoreria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => cuentasFinancieras.id),
    cuentaDestinoId: uuid("cuenta_destino_id").references(() => cuentasFinancieras.id),
    tipo: movTesoreriaTipoEnum("tipo").notNull(),
    fecha: date("fecha").notNull(),
    monto: numeric("monto", { precision: 18, scale: 4 }).notNull(),
    descripcion: text("descripcion"),
    referencia: text("referencia"),
    referenciaTabla: text("referencia_tabla"),
    referenciaId: uuid("referencia_id"),
    conciliado: boolean("conciliado").notNull().default(false),
    fechaConciliacion: date("fecha_conciliacion"),
    asientoId: uuid("asiento_id"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mov_tes_empresa_idx").on(t.empresaId),
    index("mov_tes_cuenta_idx").on(t.cuentaId),
    index("mov_tes_fecha_idx").on(t.fecha),
  ],
);

export const categoriasGasto = pgTable(
  "categorias_gasto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    cuentaContableId: uuid("cuenta_contable_id").references(() => catalogoCuentas.id),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [index("cat_gasto_empresa_idx").on(t.empresaId)],
);

export const gastos = pgTable(
  "gastos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categoriasGasto.id),
    proveedorId: uuid("proveedor_id").references(() => proveedores.id),
    cuentaFinancieraId: uuid("cuenta_financiera_id").references(
      () => cuentasFinancieras.id,
    ),
    fecha: date("fecha").notNull(),
    descripcion: text("descripcion").notNull(),
    referencia: text("referencia"),
    subtotal: numeric("subtotal", { precision: 18, scale: 4 }).notNull(),
    impuesto: numeric("impuesto", { precision: 18, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 18, scale: 4 }).notNull(),
    asientoId: uuid("asiento_id"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("gastos_empresa_idx").on(t.empresaId),
    index("gastos_fecha_idx").on(t.fecha),
    index("gastos_categoria_idx").on(t.categoriaId),
  ],
);

/* =========================================================
 * MÓDULO 8 — RECURSOS HUMANOS (RRHH)
 * ========================================================= */

export const empleadoEstadoEnum = pgEnum("empleado_estado", [
  "activo",
  "vacaciones",
  "licencia",
  "suspendido",
  "baja",
]);
export const tipoContratoEnum = pgEnum("tipo_contrato", [
  "indefinido",
  "temporal",
  "por_obra",
  "medio_tiempo",
  "practicante",
  "servicios",
]);
export const frecuenciaPagoEnum = pgEnum("frecuencia_pago", [
  "semanal",
  "quincenal",
  "mensual",
]);
export const asistenciaEstadoEnum = pgEnum("asistencia_estado", [
  "presente",
  "tarde",
  "ausente",
  "justificado",
  "permiso",
  "vacaciones",
  "incapacidad",
  "feriado",
  "descanso",
]);
export const solicitudTipoEnum = pgEnum("solicitud_rrhh_tipo", [
  "vacaciones",
  "permiso",
  "incapacidad",
  "adelanto",
  "constancia",
  "otro",
]);
export const solicitudEstadoEnum = pgEnum("solicitud_rrhh_estado", [
  "pendiente",
  "aprobada",
  "rechazada",
  "cancelada",
]);
export const nominaEstadoEnum = pgEnum("nomina_estado", [
  "borrador",
  "aprobada",
  "pagada",
  "anulada",
]);
export const vacanteEstadoEnum = pgEnum("vacante_estado", [
  "abierta",
  "pausada",
  "cerrada",
  "cancelada",
]);
export const candidatoEtapaEnum = pgEnum("candidato_etapa", [
  "aplicado",
  "preseleccion",
  "entrevista",
  "oferta",
  "contratado",
  "descartado",
]);

export const empleados = pgTable(
  "empleados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    codigo: text("codigo").notNull(),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    identificacion: text("identificacion"),
    email: text("email"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    fechaNacimiento: date("fecha_nacimiento"),
    genero: text("genero"),
    puesto: text("puesto").notNull(),
    departamento: text("departamento"),
    tipoContrato: tipoContratoEnum("tipo_contrato").notNull().default("indefinido"),
    fechaIngreso: date("fecha_ingreso").notNull(),
    fechaSalida: date("fecha_salida"),
    salarioBase: numeric("salario_base", { precision: 18, scale: 4 }).notNull().default("0"),
    frecuenciaPago: frecuenciaPagoEnum("frecuencia_pago").notNull().default("mensual"),
    diasVacacionesAnuales: integer("dias_vacaciones_anuales").notNull().default(12),
    banco: text("banco"),
    cuentaBanco: text("cuenta_banco"),
    contactoEmergenciaNombre: text("contacto_emergencia_nombre"),
    contactoEmergenciaTelefono: text("contacto_emergencia_telefono"),
    estado: empleadoEstadoEnum("estado").notNull().default("activo"),
    notas: text("notas"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [
    unique("empleados_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("empleados_empresa_idx").on(t.empresaId),
    index("empleados_estado_idx").on(t.estado),
  ],
);

export const asistencias = pgTable(
  "asistencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    empleadoId: uuid("empleado_id")
      .notNull()
      .references(() => empleados.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    estado: asistenciaEstadoEnum("estado").notNull().default("presente"),
    horaEntrada: timestamp("hora_entrada", { withTimezone: true }),
    horaSalida: timestamp("hora_salida", { withTimezone: true }),
    horasTrabajadas: numeric("horas_trabajadas", { precision: 6, scale: 2 }).notNull().default("0"),
    horasExtra: numeric("horas_extra", { precision: 6, scale: 2 }).notNull().default("0"),
    notas: text("notas"),
    registradoPor: uuid("registrado_por").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("asistencias_empleado_fecha_uq").on(t.empleadoId, t.fecha),
    index("asistencias_empresa_idx").on(t.empresaId),
    index("asistencias_fecha_idx").on(t.fecha),
  ],
);

export const feriados = pgTable(
  "feriados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    fecha: date("fecha").notNull(),
    esNacional: boolean("es_nacional").notNull().default(true),
    esRecurrente: boolean("es_recurrente").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("feriados_empresa_fecha_nombre_uq").on(t.empresaId, t.fecha, t.nombre),
    index("feriados_empresa_idx").on(t.empresaId),
    index("feriados_fecha_idx").on(t.fecha),
  ],
);

export const nominas = pgTable(
  "nominas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    numero: text("numero").notNull(),
    descripcion: text("descripcion").notNull(),
    frecuencia: frecuenciaPagoEnum("frecuencia").notNull().default("mensual"),
    periodoInicio: date("periodo_inicio").notNull(),
    periodoFin: date("periodo_fin").notNull(),
    fechaPago: date("fecha_pago").notNull(),
    estado: nominaEstadoEnum("estado").notNull().default("borrador"),
    empleadosCount: integer("empleados_count").notNull().default(0),
    totalDevengado: numeric("total_devengado", { precision: 18, scale: 4 }).notNull().default("0"),
    totalDeducciones: numeric("total_deducciones", { precision: 18, scale: 4 }).notNull().default("0"),
    totalNeto: numeric("total_neto", { precision: 18, scale: 4 }).notNull().default("0"),
    asientoDevengoId: uuid("asiento_devengo_id"),
    asientoPagoId: uuid("asiento_pago_id"),
    cuentaFinancieraId: uuid("cuenta_financiera_id").references(() => cuentasFinancieras.id),
    notas: text("notas"),
    creadoPor: uuid("creado_por").references(() => usuarios.id),
    aprobadoPor: uuid("aprobado_por").references(() => usuarios.id),
    aprobadoEn: timestamp("aprobado_en", { withTimezone: true }),
    pagadoEn: timestamp("pagado_en", { withTimezone: true }),
    anuladoEn: timestamp("anulado_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("nominas_empresa_numero_uq").on(t.empresaId, t.numero),
    index("nominas_empresa_idx").on(t.empresaId),
    index("nominas_estado_idx").on(t.estado),
  ],
);

export const nominaDetalles = pgTable(
  "nomina_detalles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nominaId: uuid("nomina_id")
      .notNull()
      .references(() => nominas.id, { onDelete: "cascade" }),
    empleadoId: uuid("empleado_id")
      .notNull()
      .references(() => empleados.id),
    salarioBase: numeric("salario_base", { precision: 18, scale: 4 }).notNull().default("0"),
    diasTrabajados: numeric("dias_trabajados", { precision: 6, scale: 2 }).notNull().default("0"),
    horasExtra: numeric("horas_extra", { precision: 6, scale: 2 }).notNull().default("0"),
    montoHorasExtra: numeric("monto_horas_extra", { precision: 18, scale: 4 }).notNull().default("0"),
    bonificaciones: numeric("bonificaciones", { precision: 18, scale: 4 }).notNull().default("0"),
    comisiones: numeric("comisiones", { precision: 18, scale: 4 }).notNull().default("0"),
    totalDevengado: numeric("total_devengado", { precision: 18, scale: 4 }).notNull().default("0"),
    deduccionSeguridadSocial: numeric("deduccion_seguridad_social", { precision: 18, scale: 4 }).notNull().default("0"),
    deduccionRenta: numeric("deduccion_renta", { precision: 18, scale: 4 }).notNull().default("0"),
    otrasDeducciones: numeric("otras_deducciones", { precision: 18, scale: 4 }).notNull().default("0"),
    totalDeducciones: numeric("total_deducciones", { precision: 18, scale: 4 }).notNull().default("0"),
    totalNeto: numeric("total_neto", { precision: 18, scale: 4 }).notNull().default("0"),
    notas: text("notas"),
  },
  (t) => [
    index("nomina_detalles_nomina_idx").on(t.nominaId),
    index("nomina_detalles_empleado_idx").on(t.empleadoId),
  ],
);

export const solicitudesRrhh = pgTable(
  "solicitudes_rrhh",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    empleadoId: uuid("empleado_id")
      .notNull()
      .references(() => empleados.id, { onDelete: "cascade" }),
    tipo: solicitudTipoEnum("tipo").notNull(),
    estado: solicitudEstadoEnum("estado").notNull().default("pendiente"),
    fechaInicio: date("fecha_inicio"),
    fechaFin: date("fecha_fin"),
    dias: numeric("dias", { precision: 6, scale: 2 }).notNull().default("0"),
    monto: numeric("monto", { precision: 18, scale: 4 }),
    motivo: text("motivo").notNull(),
    comentarioResolucion: text("comentario_resolucion"),
    resueltoPor: uuid("resuelto_por").references(() => usuarios.id),
    resueltoEn: timestamp("resuelto_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("solicitudes_rrhh_empresa_idx").on(t.empresaId),
    index("solicitudes_rrhh_empleado_idx").on(t.empleadoId),
    index("solicitudes_rrhh_estado_idx").on(t.estado),
  ],
);

export const vacantes = pgTable(
  "vacantes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    codigo: text("codigo").notNull(),
    titulo: text("titulo").notNull(),
    departamento: text("departamento"),
    descripcion: text("descripcion"),
    requisitos: text("requisitos"),
    habilidades: text("habilidades").array(),
    experienciaAnios: integer("experiencia_anios"),
    tipoContrato: tipoContratoEnum("tipo_contrato").notNull().default("indefinido"),
    salarioMin: numeric("salario_min", { precision: 18, scale: 4 }),
    salarioMax: numeric("salario_max", { precision: 18, scale: 4 }),
    plazas: integer("plazas").notNull().default(1),
    estado: vacanteEstadoEnum("estado").notNull().default("abierta"),
    fechaApertura: date("fecha_apertura").notNull(),
    fechaCierre: date("fecha_cierre"),
    creadoPor: uuid("creado_por").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("vacantes_empresa_codigo_uq").on(t.empresaId, t.codigo),
    index("vacantes_empresa_idx").on(t.empresaId),
    index("vacantes_estado_idx").on(t.estado),
  ],
);

export const candidatos = pgTable(
  "candidatos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    vacanteId: uuid("vacante_id")
      .notNull()
      .references(() => vacantes.id, { onDelete: "cascade" }),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    email: text("email"),
    telefono: text("telefono"),
    fuente: text("fuente"),
    cvUrl: text("cv_url"),
    expectativaSalarial: numeric("expectativa_salarial", { precision: 18, scale: 4 }),
    calificacion: integer("calificacion"),
    etapa: candidatoEtapaEnum("etapa").notNull().default("aplicado"),
    notas: text("notas"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidatos_empresa_idx").on(t.empresaId),
    index("candidatos_vacante_idx").on(t.vacanteId),
    index("candidatos_etapa_idx").on(t.etapa),
  ],
);

/* =========================================================
 * TIPOS INFERIDOS
 * ========================================================= */

export type Empresa = typeof empresas.$inferSelect;
export type NuevaEmpresa = typeof empresas.$inferInsert;
export type Usuario = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type Producto = typeof productos.$inferSelect;
export type Venta = typeof ventas.$inferSelect;
export type Compra = typeof compras.$inferSelect;
export type AsientoContable = typeof asientosContables.$inferSelect;
export type AsientoPartida = typeof asientoPartidas.$inferSelect;
export type CuentaContable = typeof catalogoCuentas.$inferSelect;
export type Plan = typeof planes.$inferSelect;
export type Suscripcion = typeof suscripciones.$inferSelect;
export type Sucursal = typeof sucursales.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Proveedor = typeof proveedores.$inferSelect;
export type Empleado = typeof empleados.$inferSelect;
export type NuevoEmpleado = typeof empleados.$inferInsert;
export type Asistencia = typeof asistencias.$inferSelect;
export type Feriado = typeof feriados.$inferSelect;
export type Nomina = typeof nominas.$inferSelect;
export type NominaDetalle = typeof nominaDetalles.$inferSelect;
export type SolicitudRrhh = typeof solicitudesRrhh.$inferSelect;
export type Vacante = typeof vacantes.$inferSelect;
export type Candidato = typeof candidatos.$inferSelect;
