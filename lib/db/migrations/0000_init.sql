CREATE TYPE "public"."asiento_estado" AS ENUM('borrador', 'registrado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."asiento_origen" AS ENUM('venta', 'compra', 'pago_cliente', 'pago_proveedor', 'gasto', 'ajuste_inventario', 'cierre_caja', 'apertura_caja', 'depreciacion', 'nomina', 'manual', 'cierre_periodo');--> statement-breakpoint
CREATE TYPE "public"."ciclo_facturacion" AS ENUM('mensual', 'anual');--> statement-breakpoint
CREATE TYPE "public"."compra_estado" AS ENUM('borrador', 'recibida', 'parcial', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."cotizacion_estado" AS ENUM('borrador', 'enviada', 'aceptada', 'rechazada', 'convertida', 'vencida');--> statement-breakpoint
CREATE TYPE "public"."cuenta_financiera_tipo" AS ENUM('caja', 'banco', 'tarjeta', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."cuenta_naturaleza" AS ENUM('deudora', 'acreedora');--> statement-breakpoint
CREATE TYPE "public"."cuenta_contable_tipo" AS ENUM('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto', 'orden');--> statement-breakpoint
CREATE TYPE "public"."cxc_estado" AS ENUM('pendiente', 'parcial', 'pagada', 'vencida', 'incobrable');--> statement-breakpoint
CREATE TYPE "public"."cxp_estado" AS ENUM('pendiente', 'parcial', 'pagada', 'vencida');--> statement-breakpoint
CREATE TYPE "public"."documento_fiscal_estado" AS ENUM('emitido', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."metodo_costeo" AS ENUM('promedio', 'fifo');--> statement-breakpoint
CREATE TYPE "public"."moneda" AS ENUM('HNL', 'NIO', 'GTQ', 'CRC', 'USD');--> statement-breakpoint
CREATE TYPE "public"."movimiento_inventario_tipo" AS ENUM('entrada_compra', 'salida_venta', 'ajuste_entrada', 'ajuste_salida', 'transferencia_entrada', 'transferencia_salida', 'devolucion_cliente', 'devolucion_proveedor', 'merma', 'conteo_diferencia');--> statement-breakpoint
CREATE TYPE "public"."movimiento_tesoreria_tipo" AS ENUM('ingreso', 'egreso', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."orden_compra_estado" AS ENUM('borrador', 'enviada', 'parcial', 'recibida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."pais" AS ENUM('HN', 'NI', 'GT', 'CR', 'SV');--> statement-breakpoint
CREATE TYPE "public"."periodo_estado" AS ENUM('abierto', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."plan_tipo" AS ENUM('demo', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."producto_tipo" AS ENUM('simple', 'kit', 'servicio', 'combo');--> statement-breakpoint
CREATE TYPE "public"."sesion_caja_estado" AS ENUM('abierta', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."suscripcion_estado" AS ENUM('activa', 'trial', 'vencida', 'cancelada', 'suspendida');--> statement-breakpoint
CREATE TYPE "public"."venta_estado" AS ENUM('completada', 'anulada', 'pendiente');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "abonos_cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cxc_id" uuid NOT NULL,
	"forma_pago_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"referencia" text,
	"notas" text,
	"usuario_id" uuid,
	"asiento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "almacenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"es_principal" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "almacenes_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asiento_partidas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asiento_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"centro_costo_id" uuid,
	"descripcion" text,
	"debe" numeric(18, 4) DEFAULT '0' NOT NULL,
	"haber" numeric(18, 4) DEFAULT '0' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asientos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"periodo_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"fecha" date NOT NULL,
	"concepto" text NOT NULL,
	"origen" "asiento_origen" NOT NULL,
	"referencia_tabla" text,
	"referencia_id" uuid,
	"total_debe" numeric(18, 4) NOT NULL,
	"total_haber" numeric(18, 4) NOT NULL,
	"estado" "asiento_estado" DEFAULT 'registrado' NOT NULL,
	"usuario_id" uuid,
	"anulado_en" timestamp with time zone,
	"motivo_anulacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asientos_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid,
	"accion" text NOT NULL,
	"tabla" text NOT NULL,
	"registro_id" text,
	"datos_antes" jsonb,
	"datos_despues" jsonb,
	"ip" text,
	"user_agent" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cajas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_financiera_id" uuid,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cajas_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogo_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"padre_id" uuid,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "cuenta_contable_tipo" NOT NULL,
	"naturaleza" "cuenta_naturaleza" NOT NULL,
	"nivel" integer DEFAULT 1 NOT NULL,
	"es_detalle" boolean DEFAULT true NOT NULL,
	"permite_movimiento" boolean DEFAULT true NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"padre_id" uuid,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categorias_gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_contable_id" uuid,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "centros_costo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cc_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"identificacion_fiscal" text,
	"email" text,
	"telefono" text,
	"direccion" text,
	"limite_credito" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"lista_precio_id" uuid,
	"es_consumidor_final" boolean DEFAULT false NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compra_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"lote_id" uuid,
	"cantidad" numeric(18, 4) NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"almacen_id" uuid NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"orden_id" uuid,
	"numero_factura" text,
	"fecha" date NOT NULL,
	"estado" "compra_estado" DEFAULT 'recibida' NOT NULL,
	"es_credito" boolean DEFAULT false NOT NULL,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"fecha_vencimiento" date,
	"subtotal" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"retencion" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"notas" text,
	"usuario_id" uuid,
	"asiento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "configuraciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuraciones_empresa_clave_uq" UNIQUE("empresa_id","clave")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conteo_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conteo_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad_esperada" numeric(18, 4) NOT NULL,
	"cantidad_fisica" numeric(18, 4),
	"diferencia" numeric(18, 4)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conteos_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"almacen_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" text DEFAULT 'en_progreso' NOT NULL,
	"notas" text,
	"usuario_id" uuid,
	"aplicado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotizacion_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cotizacion_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"precio_unitario" numeric(18, 4) NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cotizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"cliente_id" uuid,
	"numero" text NOT NULL,
	"fecha" date NOT NULL,
	"vigente_hasta" date,
	"estado" "cotizacion_estado" DEFAULT 'borrador' NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"venta_id" uuid,
	"notas" text,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizaciones_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cuentas_financieras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"tipo" "cuenta_financiera_tipo" NOT NULL,
	"nombre" text NOT NULL,
	"banco" text,
	"numero_cuenta" text,
	"moneda" "moneda" NOT NULL,
	"saldo_actual" numeric(18, 4) DEFAULT '0' NOT NULL,
	"cuenta_contable_id" uuid,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cuentas_por_cobrar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"venta_id" uuid,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"saldo" numeric(18, 4) NOT NULL,
	"estado" "cxc_estado" DEFAULT 'pendiente' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cuentas_por_pagar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"proveedor_id" uuid NOT NULL,
	"compra_id" uuid,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"saldo" numeric(18, 4) NOT NULL,
	"estado" "cxp_estado" DEFAULT 'pendiente' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentos_fiscales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"secuencia_id" uuid NOT NULL,
	"tipo_documento_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"referencia_tabla" text NOT NULL,
	"referencia_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"estado" "documento_fiscal_estado" DEFAULT 'emitido' NOT NULL,
	"autorizacion" text,
	"metadata" jsonb,
	CONSTRAINT "doc_fiscal_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razon_social" text NOT NULL,
	"nombre_comercial" text,
	"identificacion_fiscal" text NOT NULL,
	"pais" "pais" NOT NULL,
	"moneda" "moneda" NOT NULL,
	"telefono" text,
	"email" text,
	"direccion" text,
	"logo_url" text,
	"zona_horaria" text DEFAULT 'America/Managua' NOT NULL,
	"formato_fecha" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"onboarding_completo" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "existencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"almacen_id" uuid NOT NULL,
	"lote_id" uuid,
	"cantidad" numeric(18, 4) DEFAULT '0' NOT NULL,
	"cantidad_reservada" numeric(18, 4) DEFAULT '0' NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "existencias_uq" UNIQUE("producto_id","almacen_id","lote_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "formas_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"cuenta_financiera_id" uuid,
	"requiere_referencia" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "formas_pago_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"categoria_id" uuid NOT NULL,
	"proveedor_id" uuid,
	"cuenta_financiera_id" uuid,
	"fecha" date NOT NULL,
	"descripcion" text NOT NULL,
	"referencia" text,
	"subtotal" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"asiento_id" uuid,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "impuestos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"codigo" text NOT NULL,
	"tasa" numeric(6, 4) NOT NULL,
	"es_retencion" boolean DEFAULT false NOT NULL,
	"cuenta_contable_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "impuestos_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listas_precios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"es_default" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"fecha_vencimiento" date,
	"fecha_fabricacion" date,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lotes_producto_numero_uq" UNIQUE("producto_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marcas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marcas_empresa_nombre_uq" UNIQUE("empresa_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movimientos_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"almacen_id" uuid NOT NULL,
	"lote_id" uuid,
	"tipo" "movimiento_inventario_tipo" NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"referencia_tabla" text,
	"referencia_id" uuid,
	"notas" text,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movimientos_tesoreria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"cuenta_destino_id" uuid,
	"tipo" "movimiento_tesoreria_tipo" NOT NULL,
	"fecha" date NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"descripcion" text,
	"referencia" text,
	"referencia_tabla" text,
	"referencia_id" uuid,
	"conciliado" boolean DEFAULT false NOT NULL,
	"fecha_conciliacion" date,
	"asiento_id" uuid,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nota_credito_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nota_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"precio_unitario" numeric(18, 4) NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notas_credito" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"venta_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"fecha" date NOT NULL,
	"motivo" text NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"usuario_id" uuid,
	"asiento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nc_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orden_compra_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"cantidad_recibida" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ordenes_compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"proveedor_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"fecha" date NOT NULL,
	"fecha_esperada" date,
	"estado" "orden_compra_estado" DEFAULT 'borrador' NOT NULL,
	"subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"notas" text,
	"usuario_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oc_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagos_proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cxp_id" uuid NOT NULL,
	"cuenta_financiera_id" uuid,
	"fecha" date NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"referencia" text,
	"notas" text,
	"usuario_id" uuid,
	"asiento_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagos_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"forma_pago_id" uuid NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"referencia" text,
	"cambio" numeric(18, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "periodos_contables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"estado" "periodo_estado" DEFAULT 'abierto' NOT NULL,
	"cerrado_en" timestamp with time zone,
	"cerrado_por" uuid,
	CONSTRAINT "periodo_empresa_anio_mes_uq" UNIQUE("empresa_id","anio","mes")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permisos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clave" text NOT NULL,
	"modulo" text NOT NULL,
	"descripcion" text,
	CONSTRAINT "permisos_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "plan_tipo" NOT NULL,
	"precio_mensual" numeric(10, 2) NOT NULL,
	"precio_anual" numeric(10, 2) NOT NULL,
	"max_sucursales" integer,
	"max_usuarios" integer,
	"max_productos" integer,
	"max_transacciones_mes" integer,
	"precio_usuario_extra" numeric(10, 2),
	"precio_sucursal_extra" numeric(10, 2),
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planes_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "precios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lista_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"precio" numeric(18, 4) NOT NULL,
	"vigente_desde" date,
	"vigente_hasta" date,
	CONSTRAINT "precios_lista_producto_uq" UNIQUE("lista_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "producto_componentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_padre_id" uuid NOT NULL,
	"componente_id" uuid NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "producto_unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"unidad_id" uuid NOT NULL,
	"factor" numeric(18, 4) NOT NULL,
	"es_venta" boolean DEFAULT true NOT NULL,
	"es_compra" boolean DEFAULT true NOT NULL,
	CONSTRAINT "producto_unidad_uq" UNIQUE("producto_id","unidad_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"codigo_barras" text,
	"nombre" text NOT NULL,
	"descripcion" text,
	"tipo" "producto_tipo" DEFAULT 'simple' NOT NULL,
	"categoria_id" uuid,
	"marca_id" uuid,
	"unidad_base_id" uuid,
	"impuesto_id" uuid,
	"precio_base" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_promedio" numeric(18, 4) DEFAULT '0' NOT NULL,
	"stock_minimo" numeric(18, 4) DEFAULT '0' NOT NULL,
	"stock_maximo" numeric(18, 4),
	"metodo_costeo" "metodo_costeo" DEFAULT 'promedio' NOT NULL,
	"maneja_lotes" boolean DEFAULT false NOT NULL,
	"maneja_series" boolean DEFAULT false NOT NULL,
	"imagen_url" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "productos_empresa_sku_uq" UNIQUE("empresa_id","sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"razon_social" text NOT NULL,
	"nombre_comercial" text,
	"identificacion_fiscal" text,
	"email" text,
	"telefono" text,
	"direccion" text,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"contacto" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rol_permisos" (
	"rol_id" uuid NOT NULL,
	"permiso_id" uuid NOT NULL,
	CONSTRAINT "rol_permisos_rol_id_permiso_id_pk" PRIMARY KEY("rol_id","permiso_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"es_base" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_empresa_nombre_uq" UNIQUE("empresa_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secuencias_fiscales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"tipo_documento_id" uuid NOT NULL,
	"prefijo" text,
	"siguiente_numero" integer DEFAULT 1 NOT NULL,
	"rango_inicial" integer,
	"rango_final" integer,
	"autorizacion" text,
	"fecha_limite" date,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sesiones_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"caja_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"estado" "sesion_caja_estado" DEFAULT 'abierta' NOT NULL,
	"monto_inicial" numeric(18, 4) NOT NULL,
	"monto_final_esperado" numeric(18, 4),
	"monto_final_real" numeric(18, 4),
	"diferencia" numeric(18, 4),
	"abierta_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "sucursales_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suscripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"estado" "suscripcion_estado" DEFAULT 'trial' NOT NULL,
	"ciclo" "ciclo_facturacion" DEFAULT 'mensual' NOT NULL,
	"usuarios_extra" integer DEFAULT 0 NOT NULL,
	"sucursales_extra" integer DEFAULT 0 NOT NULL,
	"inicio_periodo" timestamp with time zone NOT NULL,
	"fin_periodo" timestamp with time zone NOT NULL,
	"cancelada_en" timestamp with time zone,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tipos_cambio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"moneda_origen" "moneda" NOT NULL,
	"moneda_destino" "moneda" NOT NULL,
	"tasa" numeric(18, 8) NOT NULL,
	"fecha" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_cambio_uq" UNIQUE("empresa_id","moneda_origen","moneda_destino","fecha")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tipos_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"aplica_a" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tipos_doc_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unidades_medida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"es_base" boolean DEFAULT false NOT NULL,
	CONSTRAINT "unidades_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuario_sucursales" (
	"usuario_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	CONSTRAINT "usuario_sucursales_usuario_id_sucursal_id_pk" PRIMARY KEY("usuario_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rol_id" uuid,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"telefono" text,
	"avatar_url" text,
	"activo" boolean DEFAULT true NOT NULL,
	"es_super_admin" boolean DEFAULT false NOT NULL,
	"ultimo_login" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "usuarios_empresa_email_uq" UNIQUE("empresa_id","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venta_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"lote_id" uuid,
	"cantidad" numeric(18, 4) NOT NULL,
	"precio_unitario" numeric(18, 4) NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"subtotal" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ventas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"sesion_caja_id" uuid,
	"cliente_id" uuid,
	"numero" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"estado" "venta_estado" DEFAULT 'completada' NOT NULL,
	"es_credito" boolean DEFAULT false NOT NULL,
	"dias_credito" integer DEFAULT 0 NOT NULL,
	"fecha_vencimiento" date,
	"subtotal" numeric(18, 4) NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) NOT NULL,
	"costo_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"notas" text,
	"usuario_id" uuid,
	"asiento_id" uuid,
	"documento_fiscal_id" uuid,
	"anulado_en" timestamp with time zone,
	"motivo_anulacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ventas_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abonos_cliente" ADD CONSTRAINT "abonos_cliente_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abonos_cliente" ADD CONSTRAINT "abonos_cliente_cxc_id_cuentas_por_cobrar_id_fk" FOREIGN KEY ("cxc_id") REFERENCES "public"."cuentas_por_cobrar"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abonos_cliente" ADD CONSTRAINT "abonos_cliente_forma_pago_id_formas_pago_id_fk" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abonos_cliente" ADD CONSTRAINT "abonos_cliente_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asiento_partidas" ADD CONSTRAINT "asiento_partidas_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asiento_partidas" ADD CONSTRAINT "asiento_partidas_cuenta_id_catalogo_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."catalogo_cuentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asiento_partidas" ADD CONSTRAINT "asiento_partidas_centro_costo_id_centros_costo_id_fk" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_periodo_id_periodos_contables_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cajas" ADD CONSTRAINT "cajas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cajas" ADD CONSTRAINT "cajas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogo_cuentas" ADD CONSTRAINT "catalogo_cuentas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categorias_gasto" ADD CONSTRAINT "categorias_gasto_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categorias_gasto" ADD CONSTRAINT "categorias_gasto_cuenta_contable_id_catalogo_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."catalogo_cuentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clientes" ADD CONSTRAINT "clientes_lista_precio_id_listas_precios_id_fk" FOREIGN KEY ("lista_precio_id") REFERENCES "public"."listas_precios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compra_detalle" ADD CONSTRAINT "compra_detalle_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compra_detalle" ADD CONSTRAINT "compra_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compra_detalle" ADD CONSTRAINT "compra_detalle_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_almacen_id_almacenes_id_fk" FOREIGN KEY ("almacen_id") REFERENCES "public"."almacenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_orden_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuraciones" ADD CONSTRAINT "configuraciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conteo_detalle" ADD CONSTRAINT "conteo_detalle_conteo_id_conteos_inventario_id_fk" FOREIGN KEY ("conteo_id") REFERENCES "public"."conteos_inventario"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conteo_detalle" ADD CONSTRAINT "conteo_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_almacen_id_almacenes_id_fk" FOREIGN KEY ("almacen_id") REFERENCES "public"."almacenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conteos_inventario" ADD CONSTRAINT "conteos_inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizacion_detalle" ADD CONSTRAINT "cotizacion_detalle_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizacion_detalle" ADD CONSTRAINT "cotizacion_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_cuenta_contable_id_catalogo_cuentas_id_fk" FOREIGN KEY ("cuenta_contable_id") REFERENCES "public"."catalogo_cuentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_secuencia_id_secuencias_fiscales_id_fk" FOREIGN KEY ("secuencia_id") REFERENCES "public"."secuencias_fiscales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "existencias" ADD CONSTRAINT "existencias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "existencias" ADD CONSTRAINT "existencias_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "existencias" ADD CONSTRAINT "existencias_almacen_id_almacenes_id_fk" FOREIGN KEY ("almacen_id") REFERENCES "public"."almacenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "existencias" ADD CONSTRAINT "existencias_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "formas_pago" ADD CONSTRAINT "formas_pago_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cuenta_financiera_id_cuentas_financieras_id_fk" FOREIGN KEY ("cuenta_financiera_id") REFERENCES "public"."cuentas_financieras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "impuestos" ADD CONSTRAINT "impuestos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listas_precios" ADD CONSTRAINT "listas_precios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lotes" ADD CONSTRAINT "lotes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marcas" ADD CONSTRAINT "marcas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_almacen_id_almacenes_id_fk" FOREIGN KEY ("almacen_id") REFERENCES "public"."almacenes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_cuenta_id_cuentas_financieras_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_financieras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_cuenta_destino_id_cuentas_financieras_id_fk" FOREIGN KEY ("cuenta_destino_id") REFERENCES "public"."cuentas_financieras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movimientos_tesoreria" ADD CONSTRAINT "movimientos_tesoreria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nota_credito_detalle" ADD CONSTRAINT "nota_credito_detalle_nota_id_notas_credito_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas_credito"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nota_credito_detalle" ADD CONSTRAINT "nota_credito_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orden_compra_detalle" ADD CONSTRAINT "orden_compra_detalle_orden_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orden_compra_detalle" ADD CONSTRAINT "orden_compra_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_cxp_id_cuentas_por_pagar_id_fk" FOREIGN KEY ("cxp_id") REFERENCES "public"."cuentas_por_pagar"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_forma_pago_id_formas_pago_id_fk" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_cerrado_por_usuarios_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "precios" ADD CONSTRAINT "precios_lista_id_listas_precios_id_fk" FOREIGN KEY ("lista_id") REFERENCES "public"."listas_precios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "precios" ADD CONSTRAINT "precios_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_componentes" ADD CONSTRAINT "producto_componentes_producto_padre_id_productos_id_fk" FOREIGN KEY ("producto_padre_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_componentes" ADD CONSTRAINT "producto_componentes_componente_id_productos_id_fk" FOREIGN KEY ("componente_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_unidades" ADD CONSTRAINT "producto_unidades_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "producto_unidades" ADD CONSTRAINT "producto_unidades_unidad_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_unidad_base_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_base_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "productos" ADD CONSTRAINT "productos_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_permisos_id_fk" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secuencias_fiscales" ADD CONSTRAINT "secuencias_fiscales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secuencias_fiscales" ADD CONSTRAINT "secuencias_fiscales_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secuencias_fiscales" ADD CONSTRAINT "secuencias_fiscales_tipo_documento_id_tipos_documento_id_fk" FOREIGN KEY ("tipo_documento_id") REFERENCES "public"."tipos_documento"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tipos_documento" ADD CONSTRAINT "tipos_documento_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unidades_medida" ADD CONSTRAINT "unidades_medida_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sesion_caja_id_sesiones_caja_id_fk" FOREIGN KEY ("sesion_caja_id") REFERENCES "public"."sesiones_caja"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abonos_empresa_idx" ON "abonos_cliente" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abonos_cxc_idx" ON "abonos_cliente" USING btree ("cxc_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "almacenes_empresa_idx" ON "almacenes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partidas_asiento_idx" ON "asiento_partidas" USING btree ("asiento_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partidas_cuenta_idx" ON "asiento_partidas" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_empresa_idx" ON "asientos_contables" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_periodo_idx" ON "asientos_contables" USING btree ("periodo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_fecha_idx" ON "asientos_contables" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_referencia_idx" ON "asientos_contables" USING btree ("referencia_tabla","referencia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auditoria_empresa_idx" ON "auditoria" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auditoria_tabla_registro_idx" ON "auditoria" USING btree ("tabla","registro_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auditoria_creado_idx" ON "auditoria" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cajas_empresa_idx" ON "cajas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuentas_empresa_idx" ON "catalogo_cuentas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuentas_padre_idx" ON "catalogo_cuentas" USING btree ("padre_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categorias_empresa_idx" ON "categorias" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cat_gasto_empresa_idx" ON "categorias_gasto" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientes_empresa_idx" ON "clientes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientes_nombre_idx" ON "clientes" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compra_detalle_compra_idx" ON "compra_detalle" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compras_empresa_idx" ON "compras" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compras_proveedor_idx" ON "compras" USING btree ("proveedor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compras_fecha_idx" ON "compras" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "configuraciones_empresa_idx" ON "configuraciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conteo_detalle_conteo_idx" ON "conteo_detalle" USING btree ("conteo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conteos_empresa_idx" ON "conteos_inventario" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotizacion_detalle_cot_idx" ON "cotizacion_detalle" USING btree ("cotizacion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cotizaciones_empresa_idx" ON "cotizaciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cuentas_fin_empresa_idx" ON "cuentas_financieras" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxc_empresa_idx" ON "cuentas_por_cobrar" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxc_cliente_idx" ON "cuentas_por_cobrar" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxc_vencimiento_idx" ON "cuentas_por_cobrar" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxp_empresa_idx" ON "cuentas_por_pagar" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxp_proveedor_idx" ON "cuentas_por_pagar" USING btree ("proveedor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cxp_vencimiento_idx" ON "cuentas_por_pagar" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_fiscal_empresa_idx" ON "documentos_fiscales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_fiscal_referencia_idx" ON "documentos_fiscales" USING btree ("referencia_tabla","referencia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empresas_pais_idx" ON "empresas" USING btree ("pais");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "existencias_empresa_idx" ON "existencias" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "existencias_almacen_idx" ON "existencias" USING btree ("almacen_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "formas_pago_empresa_idx" ON "formas_pago" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_empresa_idx" ON "gastos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_fecha_idx" ON "gastos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_categoria_idx" ON "gastos" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "impuestos_empresa_idx" ON "impuestos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listas_precios_empresa_idx" ON "listas_precios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lotes_empresa_idx" ON "lotes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lotes_vencimiento_idx" ON "lotes" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marcas_empresa_idx" ON "marcas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_empresa_idx" ON "movimientos_inventario" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_producto_idx" ON "movimientos_inventario" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_almacen_idx" ON "movimientos_inventario" USING btree ("almacen_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_referencia_idx" ON "movimientos_inventario" USING btree ("referencia_tabla","referencia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_inv_creado_idx" ON "movimientos_inventario" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_tes_empresa_idx" ON "movimientos_tesoreria" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_tes_cuenta_idx" ON "movimientos_tesoreria" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mov_tes_fecha_idx" ON "movimientos_tesoreria" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nc_detalle_nota_idx" ON "nota_credito_detalle" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nc_empresa_idx" ON "notas_credito" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oc_detalle_orden_idx" ON "orden_compra_detalle" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oc_empresa_idx" ON "ordenes_compra" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_prov_empresa_idx" ON "pagos_proveedor" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_prov_cxp_idx" ON "pagos_proveedor" USING btree ("cxp_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagos_venta_venta_idx" ON "pagos_venta" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "periodos_empresa_idx" ON "periodos_contables" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "precios_producto_idx" ON "precios" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "componentes_padre_idx" ON "producto_componentes" USING btree ("producto_padre_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "producto_unidades_producto_idx" ON "producto_unidades" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_empresa_idx" ON "productos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_nombre_idx" ON "productos" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productos_codigo_barras_idx" ON "productos" USING btree ("codigo_barras");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proveedores_empresa_idx" ON "proveedores" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proveedores_razon_idx" ON "proveedores" USING btree ("razon_social");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_empresa_idx" ON "roles" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secuencias_empresa_idx" ON "secuencias_fiscales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_empresa_idx" ON "sesiones_caja" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sesiones_caja_idx" ON "sesiones_caja" USING btree ("caja_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sucursales_empresa_idx" ON "sucursales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suscripciones_empresa_idx" ON "suscripciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tipos_cambio_empresa_idx" ON "tipos_cambio" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unidades_empresa_idx" ON "unidades_medida" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuarios_empresa_idx" ON "usuarios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuarios_email_idx" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venta_detalle_venta_idx" ON "venta_detalle" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_empresa_idx" ON "ventas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_cliente_idx" ON "ventas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_fecha_idx" ON "ventas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ventas_sucursal_idx" ON "ventas" USING btree ("sucursal_id");