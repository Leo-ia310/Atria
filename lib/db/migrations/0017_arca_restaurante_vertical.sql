DO $$ BEGIN
  CREATE TYPE "public"."empresa_vertical" AS ENUM('retail', 'restaurante');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_catalogo_tipo" AS ENUM('insumo', 'producto_directo', 'preparacion', 'platillo', 'combo');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_mesa_estado" AS ENUM('disponible', 'ocupada', 'reservada', 'por_limpiar', 'cuenta_solicitada', 'deshabilitada');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_mesa_forma" AS ENUM('redonda', 'cuadrada', 'rectangular', 'barra');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_orden_canal" AS ENUM('salon', 'qr_mesa', 'para_llevar', 'delivery_propio', 'delivery_externo', 'pedido_web');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_orden_estado" AS ENUM('borrador', 'abierta', 'en_cocina', 'cuenta_solicitada', 'pagada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_orden_item_estado" AS ENUM('borrador', 'enviado', 'preparando', 'listo', 'entregado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_comanda_estado" AS ENUM('borrador', 'enviada', 'recibida', 'preparando', 'lista', 'entregada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_estacion_tipo" AS ENUM('cocina', 'parrilla', 'bar', 'postres', 'otra');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_reservacion_estado" AS ENUM('pendiente', 'confirmada', 'sentada', 'completada', 'cancelada', 'no_show');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_espera_estado" AS ENUM('esperando', 'notificado', 'sentado', 'cancelado', 'no_show');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_merma_motivo" AS ENUM('caducidad', 'preparacion', 'accidente', 'desperdicio', 'devolucion', 'cortesia', 'otro');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_promocion_tipo" AS ENUM('porcentaje', 'monto', 'precio_fijo', 'dos_por_uno');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."restaurante_fidelizacion_movimiento_tipo" AS ENUM('acumulacion', 'redencion', 'ajuste', 'expiracion');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "vertical_empresa" "empresa_vertical" DEFAULT 'retail' NOT NULL;--> statement-breakpoint
UPDATE "empresas"
SET "vertical_empresa" = CASE WHEN "tipo_empresa" = 'restaurante' THEN 'restaurante'::"empresa_vertical" ELSE 'retail'::"empresa_vertical" END;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_estaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid REFERENCES "sucursales"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "tipo" "restaurante_estacion_tipo" DEFAULT 'cocina' NOT NULL,
  "activa" boolean DEFAULT true NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_estaciones_empresa_sucursal_nombre_uq" UNIQUE("empresa_id", "sucursal_id", "nombre")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "activa" boolean DEFAULT true NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_areas_empresa_sucursal_nombre_uq" UNIQUE("empresa_id", "sucursal_id", "nombre")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_mesas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id") ON DELETE cascade,
  "area_id" uuid REFERENCES "restaurante_areas"("id") ON DELETE set null,
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
  CONSTRAINT "restaurante_mesas_empresa_sucursal_nombre_uq" UNIQUE("empresa_id", "sucursal_id", "nombre")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_meseros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "empleado_id" uuid REFERENCES "empleados"("id") ON DELETE set null,
  "usuario_id" uuid REFERENCES "usuarios"("id") ON DELETE set null,
  "codigo" text NOT NULL,
  "nombre_publico" text,
  "activo" boolean DEFAULT true NOT NULL,
  "metas" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_meseros_empresa_codigo_uq" UNIQUE("empresa_id", "codigo")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_comensales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "cliente_id" uuid REFERENCES "clientes"("id") ON DELETE set null,
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
  CONSTRAINT "restaurante_comensales_empresa_email_uq" UNIQUE("empresa_id", "email"),
  CONSTRAINT "restaurante_comensales_empresa_telefono_uq" UNIQUE("empresa_id", "telefono")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_productos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "producto_id" uuid NOT NULL REFERENCES "productos"("id") ON DELETE cascade,
  "tipo" "restaurante_catalogo_tipo" NOT NULL,
  "estacion_id" uuid REFERENCES "restaurante_estaciones"("id") ON DELETE set null,
  "disponible_qr" boolean DEFAULT true NOT NULL,
  "consume_inventario" boolean DEFAULT true NOT NULL,
  "tiempo_preparacion_min" integer DEFAULT 0 NOT NULL,
  "alergenos" text[] DEFAULT '{}'::text[] NOT NULL,
  "etiquetas" text[] DEFAULT '{}'::text[] NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_productos_empresa_producto_uq" UNIQUE("empresa_id", "producto_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_recetas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "producto_id" uuid NOT NULL REFERENCES "productos"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "tipo" "restaurante_catalogo_tipo" DEFAULT 'platillo' NOT NULL,
  "rendimiento_cantidad" numeric(18, 4) DEFAULT '1' NOT NULL,
  "rendimiento_unidad_id" uuid REFERENCES "unidades_medida"("id"),
  "costo_total" numeric(18, 4) DEFAULT '0' NOT NULL,
  "costo_por_porcion" numeric(18, 4) DEFAULT '0' NOT NULL,
  "precio_venta" numeric(18, 4) DEFAULT '0' NOT NULL,
  "food_cost_pct" numeric(9, 4) DEFAULT '0' NOT NULL,
  "activa" boolean DEFAULT true NOT NULL,
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_recetas_empresa_producto_uq" UNIQUE("empresa_id", "producto_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_receta_ingredientes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "receta_id" uuid NOT NULL REFERENCES "restaurante_recetas"("id") ON DELETE cascade,
  "ingrediente_producto_id" uuid NOT NULL REFERENCES "productos"("id") ON DELETE restrict,
  "unidad_id" uuid REFERENCES "unidades_medida"("id"),
  "cantidad" numeric(18, 4) NOT NULL,
  "costo_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
  "merma_pct" numeric(9, 4) DEFAULT '0' NOT NULL,
  "notas" text,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_modificador_grupos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "producto_id" uuid NOT NULL REFERENCES "productos"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "obligatorio" boolean DEFAULT false NOT NULL,
  "minimo" integer DEFAULT 0 NOT NULL,
  "maximo" integer DEFAULT 1 NOT NULL,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_modificadores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "grupo_id" uuid NOT NULL REFERENCES "restaurante_modificador_grupos"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "precio_delta" numeric(18, 4) DEFAULT '0' NOT NULL,
  "ingrediente_producto_id" uuid REFERENCES "productos"("id") ON DELETE set null,
  "cantidad_ingrediente" numeric(18, 4),
  "unidad_ingrediente_id" uuid REFERENCES "unidades_medida"("id"),
  "remueve_ingrediente_producto_id" uuid REFERENCES "productos"("id") ON DELETE set null,
  "instruccion_cocina" text,
  "orden" integer DEFAULT 0 NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_ordenes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "mesa_id" uuid REFERENCES "restaurante_mesas"("id") ON DELETE set null,
  "mesero_id" uuid REFERENCES "restaurante_meseros"("id") ON DELETE set null,
  "comensal_id" uuid REFERENCES "restaurante_comensales"("id") ON DELETE set null,
  "cliente_id" uuid REFERENCES "clientes"("id") ON DELETE set null,
  "venta_id" uuid REFERENCES "ventas"("id") ON DELETE set null,
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
  "abierto_por" uuid REFERENCES "usuarios"("id"),
  "abierto_en" timestamp with time zone DEFAULT now() NOT NULL,
  "cuenta_solicitada_en" timestamp with time zone,
  "cerrado_en" timestamp with time zone,
  "cancelado_en" timestamp with time zone,
  "motivo_cancelacion" text,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_ordenes_empresa_numero_uq" UNIQUE("empresa_id", "numero"),
  CONSTRAINT "restaurante_ordenes_empresa_idempotency_uq" UNIQUE("empresa_id", "idempotency_key")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_orden_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "orden_id" uuid NOT NULL REFERENCES "restaurante_ordenes"("id") ON DELETE cascade,
  "producto_id" uuid NOT NULL REFERENCES "productos"("id"),
  "menu_platillo_id" uuid REFERENCES "menu_platillos"("id") ON DELETE set null,
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
  "cancelado_por" uuid REFERENCES "usuarios"("id"),
  "motivo_cancelacion" text,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_comandas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "orden_id" uuid NOT NULL REFERENCES "restaurante_ordenes"("id") ON DELETE cascade,
  "estacion_id" uuid REFERENCES "restaurante_estaciones"("id") ON DELETE set null,
  "numero" text NOT NULL,
  "estado" "restaurante_comanda_estado" DEFAULT 'enviada' NOT NULL,
  "prioridad" integer DEFAULT 0 NOT NULL,
  "notas" text,
  "enviada_por" uuid REFERENCES "usuarios"("id"),
  "enviada_en" timestamp with time zone DEFAULT now() NOT NULL,
  "recibida_en" timestamp with time zone,
  "preparando_en" timestamp with time zone,
  "lista_en" timestamp with time zone,
  "entregada_en" timestamp with time zone,
  "cancelada_en" timestamp with time zone,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_comandas_empresa_numero_uq" UNIQUE("empresa_id", "numero")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_comanda_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "comanda_id" uuid NOT NULL REFERENCES "restaurante_comandas"("id") ON DELETE cascade,
  "orden_item_id" uuid NOT NULL REFERENCES "restaurante_orden_items"("id") ON DELETE cascade,
  "producto_id" uuid REFERENCES "productos"("id") ON DELETE set null,
  "nombre_snapshot" text NOT NULL,
  "cantidad" numeric(18, 4) NOT NULL,
  "notas_cocina" text,
  "modificadores_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "estado" "restaurante_comanda_estado" DEFAULT 'enviada' NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_reservaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "comensal_id" uuid REFERENCES "restaurante_comensales"("id") ON DELETE set null,
  "mesa_id" uuid REFERENCES "restaurante_mesas"("id") ON DELETE set null,
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
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_lista_espera" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "comensal_id" uuid REFERENCES "restaurante_comensales"("id") ON DELETE set null,
  "nombre" text NOT NULL,
  "telefono" text,
  "personas" integer NOT NULL,
  "llegada_en" timestamp with time zone DEFAULT now() NOT NULL,
  "espera_estimada_min" integer,
  "preferencia" text,
  "notas" text,
  "estado" "restaurante_espera_estado" DEFAULT 'esperando' NOT NULL,
  "notificado_en" timestamp with time zone,
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_comensal_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "comensal_id" uuid NOT NULL REFERENCES "restaurante_comensales"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "token_ultimos4" text NOT NULL,
  "expira_en" timestamp with time zone NOT NULL,
  "ultimo_uso_en" timestamp with time zone,
  "revocado_en" timestamp with time zone,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_comensal_tokens_hash_uq" UNIQUE("token_hash")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_visitas_comensal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "comensal_id" uuid NOT NULL REFERENCES "restaurante_comensales"("id") ON DELETE cascade,
  "orden_id" uuid REFERENCES "restaurante_ordenes"("id") ON DELETE set null,
  "venta_id" uuid REFERENCES "ventas"("id") ON DELETE set null,
  "canal" "restaurante_orden_canal" DEFAULT 'qr_mesa' NOT NULL,
  "visitado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_mermas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "almacen_id" uuid NOT NULL REFERENCES "almacenes"("id"),
  "producto_id" uuid NOT NULL REFERENCES "productos"("id"),
  "unidad_id" uuid REFERENCES "unidades_medida"("id"),
  "cantidad" numeric(18, 4) NOT NULL,
  "costo_unitario" numeric(18, 4) DEFAULT '0' NOT NULL,
  "motivo" "restaurante_merma_motivo" NOT NULL,
  "observacion" text,
  "movimiento_inventario_id" uuid REFERENCES "movimientos_inventario"("id"),
  "empleado_id" uuid REFERENCES "empleados"("id") ON DELETE set null,
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "fecha" timestamp with time zone DEFAULT now() NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_promociones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "descripcion" text,
  "tipo" "restaurante_promocion_tipo" DEFAULT 'porcentaje' NOT NULL,
  "valor" numeric(18, 4) DEFAULT '0' NOT NULL,
  "producto_id" uuid REFERENCES "productos"("id") ON DELETE cascade,
  "categoria_id" uuid REFERENCES "categorias"("id") ON DELETE set null,
  "dias_semana" integer[] DEFAULT '{}'::integer[] NOT NULL,
  "hora_inicio" text,
  "hora_fin" text,
  "fecha_inicio" date,
  "fecha_fin" date,
  "cliente_segmento" text,
  "activa" boolean DEFAULT true NOT NULL,
  "reglas" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_fidelizacion_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "puntos_por_monto" numeric(18, 4) DEFAULT '1' NOT NULL,
  "monto_base" numeric(18, 4) DEFAULT '1' NOT NULL,
  "reglas" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "activa" boolean DEFAULT false NOT NULL,
  "actualizado_por" uuid REFERENCES "usuarios"("id"),
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "restaurante_fidelizacion_config_empresa_uq" UNIQUE("empresa_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_movimientos_puntos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "comensal_id" uuid NOT NULL REFERENCES "restaurante_comensales"("id") ON DELETE cascade,
  "tipo" "restaurante_fidelizacion_movimiento_tipo" NOT NULL,
  "puntos" numeric(18, 4) NOT NULL,
  "referencia_tabla" text,
  "referencia_id" uuid,
  "notas" text,
  "creado_por" uuid REFERENCES "usuarios"("id"),
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_encuestas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "nombre" text NOT NULL,
  "activa" boolean DEFAULT true NOT NULL,
  "preguntas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_encuesta_respuestas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "encuesta_id" uuid NOT NULL REFERENCES "restaurante_encuestas"("id") ON DELETE cascade,
  "comensal_id" uuid REFERENCES "restaurante_comensales"("id") ON DELETE set null,
  "venta_id" uuid REFERENCES "ventas"("id") ON DELETE set null,
  "respuestas" jsonb NOT NULL,
  "comentario" text,
  "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "restaurante_compras_sugeridas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "empresa_id" uuid NOT NULL REFERENCES "empresas"("id") ON DELETE cascade,
  "sucursal_id" uuid NOT NULL REFERENCES "sucursales"("id"),
  "producto_id" uuid NOT NULL REFERENCES "productos"("id"),
  "proveedor_id" uuid REFERENCES "proveedores"("id") ON DELETE set null,
  "existencia_actual" numeric(18, 4) DEFAULT '0' NOT NULL,
  "consumo_esperado_diario" numeric(18, 4) DEFAULT '0' NOT NULL,
  "stock_minimo" numeric(18, 4) DEFAULT '0' NOT NULL,
  "dias_cobertura" integer DEFAULT 3 NOT NULL,
  "cantidad_sugerida" numeric(18, 4) DEFAULT '0' NOT NULL,
  "estado" text DEFAULT 'sugerida' NOT NULL,
  "orden_compra_id" uuid REFERENCES "ordenes_compra"("id") ON DELETE set null,
  "generado_en" timestamp with time zone DEFAULT now() NOT NULL,
  "revisado_por" uuid REFERENCES "usuarios"("id"),
  "revisado_en" timestamp with time zone
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "restaurante_estaciones_empresa_tipo_idx" ON "restaurante_estaciones" USING btree ("empresa_id", "tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_areas_empresa_sucursal_idx" ON "restaurante_areas" USING btree ("empresa_id", "sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_empresa_sucursal_estado_idx" ON "restaurante_mesas" USING btree ("empresa_id", "sucursal_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_area_idx" ON "restaurante_mesas" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mesas_qr_hash_idx" ON "restaurante_mesas" USING btree ("qr_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_empresa_activo_idx" ON "restaurante_meseros" USING btree ("empresa_id", "activo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_usuario_idx" ON "restaurante_meseros" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_meseros_empleado_idx" ON "restaurante_meseros" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensales_empresa_ultima_idx" ON "restaurante_comensales" USING btree ("empresa_id", "ultima_visita_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensales_cliente_idx" ON "restaurante_comensales" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_productos_empresa_tipo_idx" ON "restaurante_productos" USING btree ("empresa_id", "tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_productos_estacion_idx" ON "restaurante_productos" USING btree ("estacion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_recetas_empresa_tipo_idx" ON "restaurante_recetas" USING btree ("empresa_id", "tipo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_receta_ingredientes_empresa_receta_idx" ON "restaurante_receta_ingredientes" USING btree ("empresa_id", "receta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_receta_ingredientes_producto_idx" ON "restaurante_receta_ingredientes" USING btree ("ingrediente_producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_modificador_grupos_empresa_producto_idx" ON "restaurante_modificador_grupos" USING btree ("empresa_id", "producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_modificadores_empresa_grupo_idx" ON "restaurante_modificadores" USING btree ("empresa_id", "grupo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_empresa_estado_idx" ON "restaurante_ordenes" USING btree ("empresa_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_sucursal_estado_idx" ON "restaurante_ordenes" USING btree ("sucursal_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_mesa_estado_idx" ON "restaurante_ordenes" USING btree ("mesa_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_ordenes_abierto_idx" ON "restaurante_ordenes" USING btree ("abierto_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_empresa_orden_idx" ON "restaurante_orden_items" USING btree ("empresa_id", "orden_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_producto_idx" ON "restaurante_orden_items" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_orden_items_estado_idx" ON "restaurante_orden_items" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_empresa_estado_idx" ON "restaurante_comandas" USING btree ("empresa_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_estacion_estado_idx" ON "restaurante_comandas" USING btree ("estacion_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comandas_orden_idx" ON "restaurante_comandas" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comanda_items_empresa_comanda_idx" ON "restaurante_comanda_items" USING btree ("empresa_id", "comanda_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comanda_items_orden_item_idx" ON "restaurante_comanda_items" USING btree ("orden_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_empresa_fecha_estado_idx" ON "restaurante_reservaciones" USING btree ("empresa_id", "fecha", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_sucursal_fecha_idx" ON "restaurante_reservaciones" USING btree ("sucursal_id", "fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_reservaciones_mesa_idx" ON "restaurante_reservaciones" USING btree ("mesa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_empresa_estado_idx" ON "restaurante_lista_espera" USING btree ("empresa_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_sucursal_estado_idx" ON "restaurante_lista_espera" USING btree ("sucursal_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_lista_espera_llegada_idx" ON "restaurante_lista_espera" USING btree ("llegada_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_comensal_tokens_empresa_comensal_idx" ON "restaurante_comensal_tokens" USING btree ("empresa_id", "comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_visitas_empresa_comensal_idx" ON "restaurante_visitas_comensal" USING btree ("empresa_id", "comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_visitas_empresa_fecha_idx" ON "restaurante_visitas_comensal" USING btree ("empresa_id", "visitado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_empresa_fecha_idx" ON "restaurante_mermas" USING btree ("empresa_id", "fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_producto_idx" ON "restaurante_mermas" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_mermas_sucursal_idx" ON "restaurante_mermas" USING btree ("sucursal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_empresa_activa_idx" ON "restaurante_promociones" USING btree ("empresa_id", "activa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_producto_idx" ON "restaurante_promociones" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_promociones_categoria_idx" ON "restaurante_promociones" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_puntos_empresa_comensal_idx" ON "restaurante_movimientos_puntos" USING btree ("empresa_id", "comensal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_puntos_referencia_idx" ON "restaurante_movimientos_puntos" USING btree ("referencia_tabla", "referencia_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuestas_empresa_activa_idx" ON "restaurante_encuestas" USING btree ("empresa_id", "activa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuesta_respuestas_empresa_fecha_idx" ON "restaurante_encuesta_respuestas" USING btree ("empresa_id", "creado_en");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_encuesta_respuestas_encuesta_idx" ON "restaurante_encuesta_respuestas" USING btree ("encuesta_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_compras_sugeridas_empresa_estado_idx" ON "restaurante_compras_sugeridas" USING btree ("empresa_id", "estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurante_compras_sugeridas_producto_idx" ON "restaurante_compras_sugeridas" USING btree ("producto_id");--> statement-breakpoint

INSERT INTO "permisos" ("clave", "modulo", "descripcion") VALUES
  ('restaurante.dashboard.ver', 'restaurante', 'Ver dashboard de ARCA Restaurante'),
  ('restaurante.mesas.ver', 'restaurante', 'Ver plano y estados de mesas'),
  ('restaurante.mesas.editar', 'restaurante', 'Editar areas y mesas'),
  ('restaurante.ordenes.crear', 'restaurante', 'Crear ordenes de restaurante'),
  ('restaurante.ordenes.editar', 'restaurante', 'Editar ordenes abiertas'),
  ('restaurante.ordenes.cancelar', 'restaurante', 'Cancelar ordenes de restaurante'),
  ('restaurante.comandas.enviar', 'restaurante', 'Enviar comandas a cocina'),
  ('restaurante.kds.ver', 'restaurante', 'Ver KDS por estacion'),
  ('restaurante.kds.actualizar', 'restaurante', 'Actualizar estados de KDS'),
  ('restaurante.recetas.ver', 'restaurante', 'Ver recetas y food cost'),
  ('restaurante.recetas.editar', 'restaurante', 'Editar recetas y preparaciones'),
  ('restaurante.mermas.ver', 'restaurante', 'Ver mermas'),
  ('restaurante.mermas.crear', 'restaurante', 'Registrar mermas'),
  ('restaurante.reservaciones.ver', 'restaurante', 'Ver reservaciones y lista de espera'),
  ('restaurante.reservaciones.editar', 'restaurante', 'Editar reservaciones'),
  ('restaurante.descuentos.aplicar', 'restaurante', 'Aplicar descuentos autorizados'),
  ('restaurante.cuentas.dividir', 'restaurante', 'Dividir cuentas'),
  ('restaurante.reportes.ver', 'restaurante', 'Ver reportes especializados'),
  ('restaurante.crm.ver', 'restaurante', 'Ver CRM de comensales'),
  ('restaurante.promociones.ver', 'restaurante', 'Ver promociones restaurante'),
  ('restaurante.promociones.editar', 'restaurante', 'Editar promociones restaurante')
ON CONFLICT ("clave") DO UPDATE SET
  "modulo" = EXCLUDED."modulo",
  "descripcion" = EXCLUDED."descripcion";--> statement-breakpoint

WITH restaurante_permisos("clave") AS (
  VALUES
    ('restaurante.dashboard.ver'),
    ('restaurante.mesas.ver'),
    ('restaurante.mesas.editar'),
    ('restaurante.ordenes.crear'),
    ('restaurante.ordenes.editar'),
    ('restaurante.ordenes.cancelar'),
    ('restaurante.comandas.enviar'),
    ('restaurante.kds.ver'),
    ('restaurante.kds.actualizar'),
    ('restaurante.recetas.ver'),
    ('restaurante.recetas.editar'),
    ('restaurante.mermas.ver'),
    ('restaurante.mermas.crear'),
    ('restaurante.reservaciones.ver'),
    ('restaurante.reservaciones.editar'),
    ('restaurante.descuentos.aplicar'),
    ('restaurante.cuentas.dividir'),
    ('restaurante.reportes.ver'),
    ('restaurante.crm.ver'),
    ('restaurante.promociones.ver'),
    ('restaurante.promociones.editar')
)
INSERT INTO "rol_permisos" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN restaurante_permisos rp ON true
JOIN "permisos" p ON p."clave" = rp."clave"
WHERE r."nombre" = 'Administrador'
ON CONFLICT DO NOTHING;--> statement-breakpoint

WITH gerente_permisos("clave") AS (
  VALUES
    ('restaurante.dashboard.ver'),
    ('restaurante.mesas.ver'),
    ('restaurante.mesas.editar'),
    ('restaurante.ordenes.crear'),
    ('restaurante.ordenes.editar'),
    ('restaurante.ordenes.cancelar'),
    ('restaurante.comandas.enviar'),
    ('restaurante.kds.ver'),
    ('restaurante.kds.actualizar'),
    ('restaurante.recetas.ver'),
    ('restaurante.recetas.editar'),
    ('restaurante.mermas.ver'),
    ('restaurante.mermas.crear'),
    ('restaurante.reservaciones.ver'),
    ('restaurante.reservaciones.editar'),
    ('restaurante.descuentos.aplicar'),
    ('restaurante.cuentas.dividir'),
    ('restaurante.reportes.ver'),
    ('restaurante.crm.ver'),
    ('restaurante.promociones.ver'),
    ('restaurante.promociones.editar')
)
INSERT INTO "rol_permisos" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN gerente_permisos gp ON true
JOIN "permisos" p ON p."clave" = gp."clave"
WHERE r."nombre" = 'Gerente'
ON CONFLICT DO NOTHING;--> statement-breakpoint

WITH cajero_permisos("clave") AS (
  VALUES
    ('restaurante.dashboard.ver'),
    ('restaurante.mesas.ver'),
    ('restaurante.ordenes.crear'),
    ('restaurante.ordenes.editar'),
    ('restaurante.comandas.enviar'),
    ('restaurante.kds.ver'),
    ('restaurante.cuentas.dividir')
)
INSERT INTO "rol_permisos" ("rol_id", "permiso_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN cajero_permisos cp ON true
JOIN "permisos" p ON p."clave" = cp."clave"
WHERE r."nombre" = 'Cajero'
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "unidades_medida" ("empresa_id", "codigo", "nombre", "es_base")
SELECT e."id", u."codigo", u."nombre", false
FROM "empresas" e
CROSS JOIN (
  VALUES ('G', 'Gramo'), ('ML', 'Mililitro')
) AS u("codigo", "nombre")
ON CONFLICT ("empresa_id", "codigo") DO NOTHING;--> statement-breakpoint

CREATE OR REPLACE FUNCTION atria_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION atria_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'false') = 'true'
$$;--> statement-breakpoint

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'restaurante_estaciones',
    'restaurante_areas',
    'restaurante_mesas',
    'restaurante_meseros',
    'restaurante_comensales',
    'restaurante_productos',
    'restaurante_recetas',
    'restaurante_receta_ingredientes',
    'restaurante_modificador_grupos',
    'restaurante_modificadores',
    'restaurante_ordenes',
    'restaurante_orden_items',
    'restaurante_comandas',
    'restaurante_comanda_items',
    'restaurante_reservaciones',
    'restaurante_lista_espera',
    'restaurante_comensal_tokens',
    'restaurante_visitas_comensal',
    'restaurante_mermas',
    'restaurante_promociones',
    'restaurante_fidelizacion_config',
    'restaurante_movimientos_puntos',
    'restaurante_encuestas',
    'restaurante_encuesta_respuestas',
    'restaurante_compras_sugeridas'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    pol := t || '_tenant_isolation';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (atria_bypass() OR empresa_id = atria_empresa_id()) '
      'WITH CHECK (atria_bypass() OR empresa_id = atria_empresa_id())',
      pol, t
    );
  END LOOP;
END $$;
