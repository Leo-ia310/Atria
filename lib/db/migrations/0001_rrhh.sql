CREATE TYPE "public"."asistencia_estado" AS ENUM('presente', 'tarde', 'ausente', 'justificado', 'permiso', 'vacaciones', 'incapacidad', 'feriado', 'descanso');--> statement-breakpoint
CREATE TYPE "public"."candidato_etapa" AS ENUM('aplicado', 'preseleccion', 'entrevista', 'oferta', 'contratado', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."empleado_estado" AS ENUM('activo', 'vacaciones', 'licencia', 'suspendido', 'baja');--> statement-breakpoint
CREATE TYPE "public"."frecuencia_pago" AS ENUM('semanal', 'quincenal', 'mensual');--> statement-breakpoint
CREATE TYPE "public"."nomina_estado" AS ENUM('borrador', 'aprobada', 'pagada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."solicitud_rrhh_estado" AS ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."solicitud_rrhh_tipo" AS ENUM('vacaciones', 'permiso', 'incapacidad', 'adelanto', 'constancia', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_contrato" AS ENUM('indefinido', 'temporal', 'por_obra', 'medio_tiempo', 'practicante', 'servicios');--> statement-breakpoint
CREATE TYPE "public"."vacante_estado" AS ENUM('abierta', 'pausada', 'cerrada', 'cancelada');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asistencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" "asistencia_estado" DEFAULT 'presente' NOT NULL,
	"hora_entrada" timestamp with time zone,
	"hora_salida" timestamp with time zone,
	"horas_trabajadas" numeric(6, 2) DEFAULT '0' NOT NULL,
	"horas_extra" numeric(6, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"registrado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asistencias_empleado_fecha_uq" UNIQUE("empleado_id","fecha")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"vacante_id" uuid NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"email" text,
	"telefono" text,
	"fuente" text,
	"cv_url" text,
	"expectativa_salarial" numeric(18, 4),
	"calificacion" integer,
	"etapa" "candidato_etapa" DEFAULT 'aplicado' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "empleados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"usuario_id" uuid,
	"codigo" text NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"identificacion" text,
	"email" text,
	"telefono" text,
	"direccion" text,
	"fecha_nacimiento" date,
	"genero" text,
	"puesto" text NOT NULL,
	"departamento" text,
	"tipo_contrato" "tipo_contrato" DEFAULT 'indefinido' NOT NULL,
	"fecha_ingreso" date NOT NULL,
	"fecha_salida" date,
	"salario_base" numeric(18, 4) DEFAULT '0' NOT NULL,
	"frecuencia_pago" "frecuencia_pago" DEFAULT 'mensual' NOT NULL,
	"dias_vacaciones_anuales" integer DEFAULT 12 NOT NULL,
	"banco" text,
	"cuenta_banco" text,
	"contacto_emergencia_nombre" text,
	"contacto_emergencia_telefono" text,
	"estado" "empleado_estado" DEFAULT 'activo' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "empleados_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feriados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"fecha" date NOT NULL,
	"es_nacional" boolean DEFAULT true NOT NULL,
	"es_recurrente" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feriados_empresa_fecha_nombre_uq" UNIQUE("empresa_id","fecha","nombre")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nomina_detalles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nomina_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"salario_base" numeric(18, 4) DEFAULT '0' NOT NULL,
	"dias_trabajados" numeric(6, 2) DEFAULT '0' NOT NULL,
	"horas_extra" numeric(6, 2) DEFAULT '0' NOT NULL,
	"monto_horas_extra" numeric(18, 4) DEFAULT '0' NOT NULL,
	"bonificaciones" numeric(18, 4) DEFAULT '0' NOT NULL,
	"comisiones" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_devengado" numeric(18, 4) DEFAULT '0' NOT NULL,
	"deduccion_seguridad_social" numeric(18, 4) DEFAULT '0' NOT NULL,
	"deduccion_renta" numeric(18, 4) DEFAULT '0' NOT NULL,
	"otras_deducciones" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_deducciones" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nominas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"descripcion" text NOT NULL,
	"frecuencia" "frecuencia_pago" DEFAULT 'mensual' NOT NULL,
	"periodo_inicio" date NOT NULL,
	"periodo_fin" date NOT NULL,
	"fecha_pago" date NOT NULL,
	"estado" "nomina_estado" DEFAULT 'borrador' NOT NULL,
	"empleados_count" integer DEFAULT 0 NOT NULL,
	"total_devengado" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_deducciones" numeric(18, 4) DEFAULT '0' NOT NULL,
	"total_neto" numeric(18, 4) DEFAULT '0' NOT NULL,
	"asiento_devengo_id" uuid,
	"asiento_pago_id" uuid,
	"cuenta_financiera_id" uuid,
	"notas" text,
	"creado_por" uuid,
	"aprobado_por" uuid,
	"aprobado_en" timestamp with time zone,
	"pagado_en" timestamp with time zone,
	"anulado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nominas_empresa_numero_uq" UNIQUE("empresa_id","numero")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solicitudes_rrhh" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"tipo" "solicitud_rrhh_tipo" NOT NULL,
	"estado" "solicitud_rrhh_estado" DEFAULT 'pendiente' NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"dias" numeric(6, 2) DEFAULT '0' NOT NULL,
	"monto" numeric(18, 4),
	"motivo" text NOT NULL,
	"comentario_resolucion" text,
	"resuelto_por" uuid,
	"resuelto_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vacantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"codigo" text NOT NULL,
	"titulo" text NOT NULL,
	"departamento" text,
	"descripcion" text,
	"requisitos" text,
	"tipo_contrato" "tipo_contrato" DEFAULT 'indefinido' NOT NULL,
	"salario_min" numeric(18, 4),
	"salario_max" numeric(18, 4),
	"plazas" integer DEFAULT 1 NOT NULL,
	"estado" "vacante_estado" DEFAULT 'abierta' NOT NULL,
	"fecha_apertura" date NOT NULL,
	"fecha_cierre" date,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vacantes_empresa_codigo_uq" UNIQUE("empresa_id","codigo")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_vacante_id_vacantes_id_fk" FOREIGN KEY ("vacante_id") REFERENCES "public"."vacantes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "empleados" ADD CONSTRAINT "empleados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "empleados" ADD CONSTRAINT "empleados_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "empleados" ADD CONSTRAINT "empleados_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feriados" ADD CONSTRAINT "feriados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_detalles" ADD CONSTRAINT "nomina_detalles_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_detalles" ADD CONSTRAINT "nomina_detalles_nomina_id_nominas_id_fk" FOREIGN KEY ("nomina_id") REFERENCES "public"."nominas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nomina_detalles" ADD CONSTRAINT "nomina_detalles_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominas" ADD CONSTRAINT "nominas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominas" ADD CONSTRAINT "nominas_cuenta_financiera_id_cuentas_financieras_id_fk" FOREIGN KEY ("cuenta_financiera_id") REFERENCES "public"."cuentas_financieras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominas" ADD CONSTRAINT "nominas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nominas" ADD CONSTRAINT "nominas_aprobado_por_usuarios_id_fk" FOREIGN KEY ("aprobado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "solicitudes_rrhh" ADD CONSTRAINT "solicitudes_rrhh_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "solicitudes_rrhh" ADD CONSTRAINT "solicitudes_rrhh_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "solicitudes_rrhh" ADD CONSTRAINT "solicitudes_rrhh_resuelto_por_usuarios_id_fk" FOREIGN KEY ("resuelto_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vacantes" ADD CONSTRAINT "vacantes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vacantes" ADD CONSTRAINT "vacantes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vacantes" ADD CONSTRAINT "vacantes_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asistencias_empresa_idx" ON "asistencias" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asistencias_fecha_idx" ON "asistencias" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidatos_empresa_idx" ON "candidatos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidatos_vacante_idx" ON "candidatos" USING btree ("vacante_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidatos_etapa_idx" ON "candidatos" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empleados_empresa_idx" ON "empleados" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empleados_estado_idx" ON "empleados" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feriados_empresa_idx" ON "feriados" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feriados_fecha_idx" ON "feriados" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_detalles_nomina_idx" ON "nomina_detalles" USING btree ("nomina_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nomina_detalles_empleado_idx" ON "nomina_detalles" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nominas_empresa_idx" ON "nominas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nominas_estado_idx" ON "nominas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_rrhh_empresa_idx" ON "solicitudes_rrhh" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_rrhh_empleado_idx" ON "solicitudes_rrhh" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "solicitudes_rrhh_estado_idx" ON "solicitudes_rrhh" USING btree ("estado");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacantes_empresa_idx" ON "vacantes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vacantes_estado_idx" ON "vacantes" USING btree ("estado");