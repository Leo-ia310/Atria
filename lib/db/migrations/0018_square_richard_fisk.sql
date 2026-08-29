CREATE TYPE "public"."empresa_vertical" AS ENUM('retail', 'restaurante');--> statement-breakpoint
CREATE TYPE "public"."restaurante_catalogo_tipo" AS ENUM('insumo', 'producto_directo', 'preparacion', 'platillo', 'combo');--> statement-breakpoint
CREATE TYPE "public"."restaurante_comanda_estado" AS ENUM('borrador', 'enviada', 'recibida', 'preparando', 'lista', 'entregada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."restaurante_espera_estado" AS ENUM('esperando', 'notificado', 'sentado', 'cancelado', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."restaurante_estacion_tipo" AS ENUM('cocina', 'parrilla', 'bar', 'postres', 'otra');--> statement-breakpoint
CREATE TYPE "public"."restaurante_fidelizacion_movimiento_tipo" AS ENUM('acumulacion', 'redencion', 'ajuste', 'expiracion');--> statement-breakpoint
CREATE TYPE "public"."restaurante_merma_motivo" AS ENUM('caducidad', 'preparacion', 'accidente', 'desperdicio', 'devolucion', 'cortesia', 'otro');--> statement-breakpoint
CREATE TYPE "public"."restaurante_mesa_estado" AS ENUM('disponible', 'ocupada', 'reservada', 'por_limpiar', 'cuenta_solicitada', 'deshabilitada');--> statement-breakpoint
CREATE TYPE "public"."restaurante_mesa_forma" AS ENUM('redonda', 'cuadrada', 'rectangular', 'barra');--> statement-breakpoint
CREATE TYPE "public"."restaurante_orden_canal" AS ENUM('salon', 'qr_mesa', 'para_llevar', 'delivery_propio', 'delivery_externo', 'pedido_web');--> statement-breakpoint
CREATE TYPE "public"."restaurante_orden_estado" AS ENUM('borrador', 'abierta', 'en_cocina', 'cuenta_solicitada', 'pagada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."restaurante_orden_item_estado" AS ENUM('borrador', 'enviado', 'preparando', 'listo', 'entregado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."restaurante_promocion_tipo" AS ENUM('porcentaje', 'monto', 'precio_fijo', 'dos_por_uno');--> statement-breakpoint
CREATE TYPE "public"."restaurante_reservacion_estado" AS ENUM('pendiente', 'confirmada', 'sentada', 'completada', 'cancelada', 'no_show');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asistente_ia_uso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"plan_codigo" "plan_tipo" NOT NULL,
	"fecha" date NOT NULL,
	"preguntas" integer DEFAULT 0 NOT NULL,
	"palabras_entrada" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asistente_ia_uso_empresa_usuario_fecha_uq" UNIQUE("empresa_id","usuario_id","fecha")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gastos_plataforma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date NOT NULL,
	"categoria" text NOT NULL,
	"proveedor" text,
	"descripcion" text NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"metodo_pago" text,
	"recurrente" boolean DEFAULT false NOT NULL,
	"notas" text,
	"creado_por_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referidos_atribuciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo_referido" text NOT NULL,
	"primer_pago_id" uuid,
	"origen" text DEFAULT 'pago_paypal' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fijado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referidos_atribuciones_empresa_uq" UNIQUE("empresa_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referidos_pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"pago_suscripcion_id" uuid NOT NULL,
	"codigo_referido" text NOT NULL,
	"plan_codigo" "plan_tipo" NOT NULL,
	"ciclo" "ciclo_facturacion" NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"tipo_comision" text NOT NULL,
	"referencia_externa" text NOT NULL,
	"estado_notificacion" text DEFAULT 'pendiente' NOT NULL,
	"notificado_en" timestamp with time zone,
	"error_notificacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referidos_pagos_pago_uq" UNIQUE("pago_suscripcion_id"),
	CONSTRAINT "referidos_pagos_referencia_uq" UNIQUE("referencia_externa")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_areas_empresa_sucursal_nombre_uq" UNIQUE("empresa_id","sucursal_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_comanda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"orden_item_id" uuid NOT NULL,
	"producto_id" uuid,
	"nombre_snapshot" text NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"notas_cocina" text,
	"modificadores_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado" "restaurante_comanda_estado" DEFAULT 'enviada' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_comandas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"orden_id" uuid NOT NULL,
	"estacion_id" uuid,
	"numero" text NOT NULL,
	"estado" "restaurante_comanda_estado" DEFAULT 'enviada' NOT NULL,
	"prioridad" integer DEFAULT 0 NOT NULL,
	"notas" text,
	"enviada_por" uuid,
	"enviada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"recibida_en" timestamp with time zone,
	"preparando_en" timestamp with time zone,
	"lista_en" timestamp with time zone,
	"entregada_en" timestamp with time zone,
	"cancelada_en" timestamp with time zone,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_comandas_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_comensal_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"comensal_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_ultimos4" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ultimo_uso_en" timestamp with time zone,
	"revocado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_comensal_tokens_hash_uq" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_comensales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cliente_id" uuid,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"cumpleanos" date,
	"genero" text,
	"visitas" integer DEFAULT 0 NOT NULL,
	"gasto_historico" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ticket_promedio" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ultima_visita_en" timestamp with time zone,
	"platillos_frecuentes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferencias" text,
	"alergias" text,
	"notas" text,
	"ocasiones_especiales" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_comensales_empresa_email_uq" UNIQUE("empresa_id","email"),
	CONSTRAINT "restaurante_comensales_empresa_telefono_uq" UNIQUE("empresa_id","telefono")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_compras_sugeridas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"proveedor_id" uuid,
	"existencia_actual" numeric(18, 4) DEFAULT '0' NOT NULL,
	"consumo_esperado_diario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"stock_minimo" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dias_cobertura" integer DEFAULT 3 NOT NULL,
	"cantidad_sugerida" numeric(18, 4) DEFAULT '0' NOT NULL,
	"estado" text DEFAULT 'sugerida' NOT NULL,
	"orden_compra_id" uuid,
	"generado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"revisado_por" uuid,
	"revisado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_encuesta_respuestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"encuesta_id" uuid NOT NULL,
	"comensal_id" uuid,
	"venta_id" uuid,
	"respuestas" jsonb NOT NULL,
	"comentario" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_encuestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"preguntas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_estaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"nombre" text NOT NULL,
	"tipo" "restaurante_estacion_tipo" DEFAULT 'cocina' NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_estaciones_empresa_sucursal_nombre_uq" UNIQUE("empresa_id","sucursal_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_fidelizacion_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"puntos_por_monto" numeric(18, 4) DEFAULT '1' NOT NULL,
	"monto_base" numeric(18, 4) DEFAULT '1' NOT NULL,
	"reglas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activa" boolean DEFAULT false NOT NULL,
	"actualizado_por" uuid,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_fidelizacion_config_empresa_uq" UNIQUE("empresa_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_lista_espera" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"comensal_id" uuid,
	"nombre" text NOT NULL,
	"telefono" text,
	"personas" integer NOT NULL,
	"llegada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"espera_estimada_min" integer,
	"preferencia" text,
	"notas" text,
	"estado" "restaurante_espera_estado" DEFAULT 'esperando' NOT NULL,
	"notificado_en" timestamp with time zone,
	"creado_por" uuid,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_mermas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"almacen_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"unidad_id" uuid,
	"cantidad" numeric(18, 4) NOT NULL,
	"costo_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"motivo" "restaurante_merma_motivo" NOT NULL,
	"observacion" text,
	"movimiento_inventario_id" uuid,
	"empleado_id" uuid,
	"creado_por" uuid,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_mesas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"area_id" uuid,
	"nombre" text NOT NULL,
	"capacidad" integer DEFAULT 2 NOT NULL,
	"pos_x" numeric(8, 4) DEFAULT '0.5' NOT NULL,
	"pos_y" numeric(8, 4) DEFAULT '0.5' NOT NULL,
	"ancho" numeric(8, 4) DEFAULT '0.14' NOT NULL,
	"alto" numeric(8, 4) DEFAULT '0.1' NOT NULL,
	"forma" "restaurante_mesa_forma" DEFAULT 'rectangular' NOT NULL,
	"estado" "restaurante_mesa_estado" DEFAULT 'disponible' NOT NULL,
	"qr_token_hash" text,
	"qr_token_ultimos4" text,
	"qr_token_version" integer DEFAULT 1 NOT NULL,
	"qr_token_revocado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_mesas_empresa_sucursal_nombre_uq" UNIQUE("empresa_id","sucursal_id","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_meseros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid,
	"usuario_id" uuid,
	"codigo" text NOT NULL,
	"nombre_publico" text,
	"activo" boolean DEFAULT true NOT NULL,
	"metas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_meseros_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_modificador_grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"obligatorio" boolean DEFAULT false NOT NULL,
	"minimo" integer DEFAULT 0 NOT NULL,
	"maximo" integer DEFAULT 1 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio_delta" numeric(18, 4) DEFAULT '0' NOT NULL,
	"ingrediente_producto_id" uuid,
	"cantidad_ingrediente" numeric(18, 4),
	"unidad_ingrediente_id" uuid,
	"remueve_ingrediente_producto_id" uuid,
	"instruccion_cocina" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_movimientos_puntos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"comensal_id" uuid NOT NULL,
	"tipo" "restaurante_fidelizacion_movimiento_tipo" NOT NULL,
	"puntos" numeric(18, 4) NOT NULL,
	"referencia_tabla" text,
	"referencia_id" uuid,
	"notas" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_orden_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"orden_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"menu_platillo_id" uuid,
	"nombre_snapshot" text NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"precio_unitario" numeric(18, 4) NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"estado" "restaurante_orden_item_estado" DEFAULT 'borrador' NOT NULL,
	"notas_cocina" text,
	"modificadores_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enviado_cocina_en" timestamp with time zone,
	"cancelado_en" timestamp with time zone,
	"cancelado_por" uuid,
	"motivo_cancelacion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_ordenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"mesa_id" uuid,
	"mesero_id" uuid,
	"comensal_id" uuid,
	"cliente_id" uuid,
	"venta_id" uuid,
	"numero" text NOT NULL,
	"canal" "restaurante_orden_canal" DEFAULT 'salon' NOT NULL,
	"estado" "restaurante_orden_estado" DEFAULT 'abierta' NOT NULL,
	"personas" integer DEFAULT 1 NOT NULL,
	"subtotal" numeric(18, 4) DEFAULT '0' NOT NULL,
	"descuento" numeric(18, 4) DEFAULT '0' NOT NULL,
	"impuesto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"propina" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"notas" text,
	"idempotency_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"abierto_por" uuid,
	"abierto_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cuenta_solicitada_en" timestamp with time zone,
	"cerrado_en" timestamp with time zone,
	"cancelado_en" timestamp with time zone,
	"motivo_cancelacion" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_ordenes_empresa_numero_uq" UNIQUE("empresa_id","numero"),
	CONSTRAINT "restaurante_ordenes_empresa_idempotency_uq" UNIQUE("empresa_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo" "restaurante_catalogo_tipo" NOT NULL,
	"estacion_id" uuid,
	"disponible_qr" boolean DEFAULT true NOT NULL,
	"consume_inventario" boolean DEFAULT true NOT NULL,
	"tiempo_preparacion_min" integer DEFAULT 0 NOT NULL,
	"alergenos" text[] DEFAULT '{}'::text[] NOT NULL,
	"etiquetas" text[] DEFAULT '{}'::text[] NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_productos_empresa_producto_uq" UNIQUE("empresa_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_promociones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"tipo" "restaurante_promocion_tipo" DEFAULT 'porcentaje' NOT NULL,
	"valor" numeric(18, 4) DEFAULT '0' NOT NULL,
	"producto_id" uuid,
	"categoria_id" uuid,
	"dias_semana" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"hora_inicio" text,
	"hora_fin" text,
	"fecha_inicio" date,
	"fecha_fin" date,
	"cliente_segmento" text,
	"activa" boolean DEFAULT true NOT NULL,
	"reglas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_receta_ingredientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"receta_id" uuid NOT NULL,
	"ingrediente_producto_id" uuid NOT NULL,
	"unidad_id" uuid,
	"cantidad" numeric(18, 4) NOT NULL,
	"costo_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
	"merma_pct" numeric(9, 4) DEFAULT '0' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_recetas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "restaurante_catalogo_tipo" DEFAULT 'platillo' NOT NULL,
	"rendimiento_cantidad" numeric(18, 4) DEFAULT '1' NOT NULL,
	"rendimiento_unidad_id" uuid,
	"costo_total" numeric(18, 4) DEFAULT '0' NOT NULL,
	"costo_por_porcion" numeric(18, 4) DEFAULT '0' NOT NULL,
	"precio_venta" numeric(18, 4) DEFAULT '0' NOT NULL,
	"food_cost_pct" numeric(9, 4) DEFAULT '0' NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurante_recetas_empresa_producto_uq" UNIQUE("empresa_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_reservaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"comensal_id" uuid,
	"mesa_id" uuid,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"fecha" date NOT NULL,
	"hora" text NOT NULL,
	"personas" integer NOT NULL,
	"ocasion_especial" text,
	"notas" text,
	"estado" "restaurante_reservacion_estado" DEFAULT 'pendiente' NOT NULL,
	"deposito_monto" numeric(18, 4),
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurante_visitas_comensal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"comensal_id" uuid NOT NULL,
	"orden_id" uuid,
	"venta_id" uuid,
	"canal" "restaurante_orden_canal" DEFAULT 'qr_mesa' NOT NULL,
	"visitado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asientos_contables" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "vertical_empresa" "empresa_vertical" DEFAULT 'retail' NOT NULL;--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint
ALTER TABLE "planes" ADD COLUMN "precio_semestral" numeric(10, 2) NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asistente_ia_uso" ADD CONSTRAINT "asistente_ia_uso_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asistente_ia_uso" ADD CONSTRAINT "asistente_ia_uso_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_plataforma" ADD CONSTRAINT "gastos_plataforma_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referidos_atribuciones" ADD CONSTRAINT "referidos_atribuciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referidos_atribuciones" ADD CONSTRAINT "referidos_atribuciones_primer_pago_id_pagos_suscripcion_id_fk" FOREIGN KEY ("primer_pago_id") REFERENCES "public"."pagos_suscripcion"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referidos_pagos" ADD CONSTRAINT "referidos_pagos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referidos_pagos" ADD CONSTRAINT "referidos_pagos_pago_suscripcion_id_pagos_suscripcion_id_fk" FOREIGN KEY ("pago_suscripcion_id") REFERENCES "public"."pagos_suscripcion"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_areas" ADD CONSTRAINT "restaurante_areas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_areas" ADD CONSTRAINT "restaurante_areas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comanda_items" ADD CONSTRAINT "restaurante_comanda_items_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comanda_items" ADD CONSTRAINT "restaurante_comanda_items_comanda_id_restaurante_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "public"."restaurante_comandas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comanda_items" ADD CONSTRAINT "restaurante_comanda_items_orden_item_id_restaurante_orden_items_id_fk" FOREIGN KEY ("orden_item_id") REFERENCES "public"."restaurante_orden_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comanda_items" ADD CONSTRAINT "restaurante_comanda_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comandas" ADD CONSTRAINT "restaurante_comandas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comandas" ADD CONSTRAINT "restaurante_comandas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comandas" ADD CONSTRAINT "restaurante_comandas_orden_id_restaurante_ordenes_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."restaurante_ordenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comandas" ADD CONSTRAINT "restaurante_comandas_estacion_id_restaurante_estaciones_id_fk" FOREIGN KEY ("estacion_id") REFERENCES "public"."restaurante_estaciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comandas" ADD CONSTRAINT "restaurante_comandas_enviada_por_usuarios_id_fk" FOREIGN KEY ("enviada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comensal_tokens" ADD CONSTRAINT "restaurante_comensal_tokens_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comensal_tokens" ADD CONSTRAINT "restaurante_comensal_tokens_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comensales" ADD CONSTRAINT "restaurante_comensales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_comensales" ADD CONSTRAINT "restaurante_comensales_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_orden_compra_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_compra_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_compras_sugeridas" ADD CONSTRAINT "restaurante_compras_sugeridas_revisado_por_usuarios_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_encuesta_respuestas" ADD CONSTRAINT "restaurante_encuesta_respuestas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_encuesta_respuestas" ADD CONSTRAINT "restaurante_encuesta_respuestas_encuesta_id_restaurante_encuestas_id_fk" FOREIGN KEY ("encuesta_id") REFERENCES "public"."restaurante_encuestas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_encuesta_respuestas" ADD CONSTRAINT "restaurante_encuesta_respuestas_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_encuesta_respuestas" ADD CONSTRAINT "restaurante_encuesta_respuestas_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_encuestas" ADD CONSTRAINT "restaurante_encuestas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_estaciones" ADD CONSTRAINT "restaurante_estaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_estaciones" ADD CONSTRAINT "restaurante_estaciones_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_fidelizacion_config" ADD CONSTRAINT "restaurante_fidelizacion_config_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_fidelizacion_config" ADD CONSTRAINT "restaurante_fidelizacion_config_actualizado_por_usuarios_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_lista_espera" ADD CONSTRAINT "restaurante_lista_espera_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_lista_espera" ADD CONSTRAINT "restaurante_lista_espera_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_lista_espera" ADD CONSTRAINT "restaurante_lista_espera_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_lista_espera" ADD CONSTRAINT "restaurante_lista_espera_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_almacen_id_almacenes_id_fk" FOREIGN KEY ("almacen_id") REFERENCES "public"."almacenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_unidad_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_movimiento_inventario_id_movimientos_inventario_id_fk" FOREIGN KEY ("movimiento_inventario_id") REFERENCES "public"."movimientos_inventario"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mermas" ADD CONSTRAINT "restaurante_mermas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mesas" ADD CONSTRAINT "restaurante_mesas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mesas" ADD CONSTRAINT "restaurante_mesas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_mesas" ADD CONSTRAINT "restaurante_mesas_area_id_restaurante_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."restaurante_areas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_meseros" ADD CONSTRAINT "restaurante_meseros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_meseros" ADD CONSTRAINT "restaurante_meseros_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_meseros" ADD CONSTRAINT "restaurante_meseros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificador_grupos" ADD CONSTRAINT "restaurante_modificador_grupos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificador_grupos" ADD CONSTRAINT "restaurante_modificador_grupos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificadores" ADD CONSTRAINT "restaurante_modificadores_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificadores" ADD CONSTRAINT "restaurante_modificadores_grupo_id_restaurante_modificador_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."restaurante_modificador_grupos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificadores" ADD CONSTRAINT "restaurante_modificadores_ingrediente_producto_id_productos_id_fk" FOREIGN KEY ("ingrediente_producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificadores" ADD CONSTRAINT "restaurante_modificadores_unidad_ingrediente_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_ingrediente_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_modificadores" ADD CONSTRAINT "restaurante_modificadores_remueve_ingrediente_producto_id_productos_id_fk" FOREIGN KEY ("remueve_ingrediente_producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_movimientos_puntos" ADD CONSTRAINT "restaurante_movimientos_puntos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_movimientos_puntos" ADD CONSTRAINT "restaurante_movimientos_puntos_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_movimientos_puntos" ADD CONSTRAINT "restaurante_movimientos_puntos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_orden_items" ADD CONSTRAINT "restaurante_orden_items_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_orden_items" ADD CONSTRAINT "restaurante_orden_items_orden_id_restaurante_ordenes_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."restaurante_ordenes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_orden_items" ADD CONSTRAINT "restaurante_orden_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_orden_items" ADD CONSTRAINT "restaurante_orden_items_menu_platillo_id_menu_platillos_id_fk" FOREIGN KEY ("menu_platillo_id") REFERENCES "public"."menu_platillos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_orden_items" ADD CONSTRAINT "restaurante_orden_items_cancelado_por_usuarios_id_fk" FOREIGN KEY ("cancelado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_mesa_id_restaurante_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."restaurante_mesas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_mesero_id_restaurante_meseros_id_fk" FOREIGN KEY ("mesero_id") REFERENCES "public"."restaurante_meseros"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_ordenes" ADD CONSTRAINT "restaurante_ordenes_abierto_por_usuarios_id_fk" FOREIGN KEY ("abierto_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_productos" ADD CONSTRAINT "restaurante_productos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_productos" ADD CONSTRAINT "restaurante_productos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_productos" ADD CONSTRAINT "restaurante_productos_estacion_id_restaurante_estaciones_id_fk" FOREIGN KEY ("estacion_id") REFERENCES "public"."restaurante_estaciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_promociones" ADD CONSTRAINT "restaurante_promociones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_promociones" ADD CONSTRAINT "restaurante_promociones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_promociones" ADD CONSTRAINT "restaurante_promociones_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_promociones" ADD CONSTRAINT "restaurante_promociones_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_receta_ingredientes" ADD CONSTRAINT "restaurante_receta_ingredientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_receta_ingredientes" ADD CONSTRAINT "restaurante_receta_ingredientes_receta_id_restaurante_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."restaurante_recetas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_receta_ingredientes" ADD CONSTRAINT "restaurante_receta_ingredientes_ingrediente_producto_id_productos_id_fk" FOREIGN KEY ("ingrediente_producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_receta_ingredientes" ADD CONSTRAINT "restaurante_receta_ingredientes_unidad_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_recetas" ADD CONSTRAINT "restaurante_recetas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_recetas" ADD CONSTRAINT "restaurante_recetas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_recetas" ADD CONSTRAINT "restaurante_recetas_rendimiento_unidad_id_unidades_medida_id_fk" FOREIGN KEY ("rendimiento_unidad_id") REFERENCES "public"."unidades_medida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_recetas" ADD CONSTRAINT "restaurante_recetas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_reservaciones" ADD CONSTRAINT "restaurante_reservaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_reservaciones" ADD CONSTRAINT "restaurante_reservaciones_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_reservaciones" ADD CONSTRAINT "restaurante_reservaciones_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_reservaciones" ADD CONSTRAINT "restaurante_reservaciones_mesa_id_restaurante_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "public"."restaurante_mesas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_reservaciones" ADD CONSTRAINT "restaurante_reservaciones_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_visitas_comensal" ADD CONSTRAINT "restaurante_visitas_comensal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_visitas_comensal" ADD CONSTRAINT "restaurante_visitas_comensal_comensal_id_restaurante_comensales_id_fk" FOREIGN KEY ("comensal_id") REFERENCES "public"."restaurante_comensales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_visitas_comensal" ADD CONSTRAINT "restaurante_visitas_comensal_orden_id_restaurante_ordenes_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."restaurante_ordenes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurante_visitas_comensal" ADD CONSTRAINT "restaurante_visitas_comensal_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asistente_ia_uso_empresa_fecha_idx" ON "asistente_ia_uso" USING btree ("empresa_id","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_plataforma_fecha_idx" ON "gastos_plataforma" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_plataforma_categoria_idx" ON "gastos_plataforma" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_atribuciones_codigo_idx" ON "referidos_atribuciones" USING btree ("codigo_referido");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_empresa_idx" ON "referidos_pagos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_codigo_idx" ON "referidos_pagos" USING btree ("codigo_referido");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_plan_idx" ON "referidos_pagos" USING btree ("empresa_id","plan_codigo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referidos_pagos_estado_notificacion_idx" ON "referidos_pagos" USING btree ("estado_notificacion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_areas_empresa_sucursal_idx" ON "restaurante_areas" USING btree ("empresa_id","sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comanda_items_empresa_comanda_idx" ON "restaurante_comanda_items" USING btree ("empresa_id","comanda_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comanda_items_orden_item_idx" ON "restaurante_comanda_items" USING btree ("orden_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_empresa_estado_idx" ON "restaurante_comandas" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_estacion_estado_idx" ON "restaurante_comandas" USING btree ("estacion_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_orden_idx" ON "restaurante_comandas" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensal_tokens_empresa_comensal_idx" ON "restaurante_comensal_tokens" USING btree ("empresa_id","comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensales_empresa_ultima_idx" ON "restaurante_comensales" USING btree ("empresa_id","ultima_visita_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensales_cliente_idx" ON "restaurante_comensales" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_compras_sugeridas_empresa_estado_idx" ON "restaurante_compras_sugeridas" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_compras_sugeridas_producto_idx" ON "restaurante_compras_sugeridas" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuesta_respuestas_empresa_fecha_idx" ON "restaurante_encuesta_respuestas" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuesta_respuestas_encuesta_idx" ON "restaurante_encuesta_respuestas" USING btree ("encuesta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuestas_empresa_activa_idx" ON "restaurante_encuestas" USING btree ("empresa_id","activa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_estaciones_empresa_tipo_idx" ON "restaurante_estaciones" USING btree ("empresa_id","tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_empresa_estado_idx" ON "restaurante_lista_espera" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_sucursal_estado_idx" ON "restaurante_lista_espera" USING btree ("sucursal_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_llegada_idx" ON "restaurante_lista_espera" USING btree ("llegada_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_empresa_fecha_idx" ON "restaurante_mermas" USING btree ("empresa_id","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_producto_idx" ON "restaurante_mermas" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_sucursal_idx" ON "restaurante_mermas" USING btree ("sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_empresa_sucursal_estado_idx" ON "restaurante_mesas" USING btree ("empresa_id","sucursal_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_area_idx" ON "restaurante_mesas" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_qr_hash_idx" ON "restaurante_mesas" USING btree ("qr_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_empresa_activo_idx" ON "restaurante_meseros" USING btree ("empresa_id","activo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_usuario_idx" ON "restaurante_meseros" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_empleado_idx" ON "restaurante_meseros" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_modificador_grupos_empresa_producto_idx" ON "restaurante_modificador_grupos" USING btree ("empresa_id","producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_modificadores_empresa_grupo_idx" ON "restaurante_modificadores" USING btree ("empresa_id","grupo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_puntos_empresa_comensal_idx" ON "restaurante_movimientos_puntos" USING btree ("empresa_id","comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_puntos_referencia_idx" ON "restaurante_movimientos_puntos" USING btree ("referencia_tabla","referencia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_empresa_orden_idx" ON "restaurante_orden_items" USING btree ("empresa_id","orden_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_producto_idx" ON "restaurante_orden_items" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_estado_idx" ON "restaurante_orden_items" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_empresa_estado_idx" ON "restaurante_ordenes" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_sucursal_estado_idx" ON "restaurante_ordenes" USING btree ("sucursal_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_mesa_estado_idx" ON "restaurante_ordenes" USING btree ("mesa_id","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_abierto_idx" ON "restaurante_ordenes" USING btree ("abierto_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_productos_empresa_tipo_idx" ON "restaurante_productos" USING btree ("empresa_id","tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_productos_estacion_idx" ON "restaurante_productos" USING btree ("estacion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_empresa_activa_idx" ON "restaurante_promociones" USING btree ("empresa_id","activa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_producto_idx" ON "restaurante_promociones" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_categoria_idx" ON "restaurante_promociones" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_receta_ingredientes_empresa_receta_idx" ON "restaurante_receta_ingredientes" USING btree ("empresa_id","receta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_receta_ingredientes_producto_idx" ON "restaurante_receta_ingredientes" USING btree ("ingrediente_producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_recetas_empresa_tipo_idx" ON "restaurante_recetas" USING btree ("empresa_id","tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_empresa_fecha_estado_idx" ON "restaurante_reservaciones" USING btree ("empresa_id","fecha","estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_sucursal_fecha_idx" ON "restaurante_reservaciones" USING btree ("sucursal_id","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_mesa_idx" ON "restaurante_reservaciones" USING btree ("mesa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_visitas_empresa_comensal_idx" ON "restaurante_visitas_comensal" USING btree ("empresa_id","comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_visitas_empresa_fecha_idx" ON "restaurante_visitas_comensal" USING btree ("empresa_id","visitado_en");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_empresa_sucursal_fecha_idx" ON "asientos_contables" USING btree ("empresa_id","sucursal_id","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asientos_empresa_sucursal_estado_fecha_idx" ON "asientos_contables" USING btree ("empresa_id","sucursal_id","estado","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gastos_recurrentes_sucursal_idx" ON "gastos_recurrentes" USING btree ("sucursal_id");