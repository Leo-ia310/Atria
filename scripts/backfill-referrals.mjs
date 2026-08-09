import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
loadEnv(path.join(root, ".env"));

const databaseUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
const backendUrl = process.env.VENDEDORES_ATRIA_BACKEND_URL;
const secret = process.env.VENDEDORES_ATRIA_WEBHOOK_SECRET;
const dryRun = process.argv.includes("--dry-run") || process.env.npm_config_dry_run === "true";
const onlyCode = normalizeCode(readArg("--codigo") || process.env.npm_config_codigo);
const limit = Math.max(1, Math.min(500, Number(readArg("--limit") || process.env.npm_config_limit || 100)));

if (!databaseUrl) {
  console.error("DATABASE_POOL_URL o DATABASE_URL no esta configurado.");
  process.exit(1);
}

if ((!backendUrl || !secret) && !dryRun) {
  console.error("Configura VENDEDORES_ATRIA_BACKEND_URL y VENDEDORES_ATRIA_WEBHOOK_SECRET antes de reenviar referidos.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: "require" });

try {
  const rows = await sql`
    with pagos_base as (
      select
        p.id::text as pago_id,
        p.empresa_id::text as empresa_id,
        p.plan_codigo,
        p.ciclo,
        p.monto,
        p.estado,
        p.pagador_email,
        p.pagador_nombre,
        p.creado_en,
        p.completado_en,
        coalesce(
          rp.codigo_referido,
          ra.codigo_referido,
          upper(regexp_replace(trim(e.codigo_referido), '[^A-Za-z0-9_-]', '', 'g'))
        ) as codigo_referido,
        rp.tipo_comision as tipo_comision_registrado,
        rp.referencia_externa as referencia_registrada,
        rp.estado_notificacion,
        e.email as empresa_email,
        coalesce(e.nombre_comercial, e.razon_social) as empresa_nombre,
        row_number() over (
          partition by p.empresa_id, p.plan_codigo
          order by coalesce(p.completado_en, p.creado_en) asc, p.creado_en asc
        ) as numero_pago_plan
      from pagos_suscripcion p
      join empresas e on e.id = p.empresa_id
      left join referidos_atribuciones ra on ra.empresa_id = p.empresa_id
      left join referidos_pagos rp on rp.pago_suscripcion_id = p.id
      where p.estado = 'completado'
        and p.plan_codigo in ('pro', 'enterprise')
    ),
    pagos_ref as (
      select
        *,
        concat(
          'plan:',
          empresa_id,
          ':',
          plan_codigo::text,
          ':',
          ciclo::text,
          ':',
          to_char(coalesce(completado_en, creado_en), 'YYYY-MM-DD')
        ) as referencia_legacy,
        row_number() over (
          partition by empresa_id, plan_codigo, ciclo, coalesce(completado_en, creado_en)::date
          order by coalesce(completado_en, creado_en) asc, creado_en asc, pago_id asc
        ) as numero_referencia
      from pagos_base
      where codigo_referido is not null
        and trim(codigo_referido) <> ''
    )
    select
      *,
      coalesce(
        tipo_comision_registrado,
        case when numero_pago_plan = 1 then 'primera' else 'renovacion' end
      ) as tipo_comision,
      coalesce(
        referencia_registrada,
        case
          when numero_referencia = 1 then referencia_legacy
          else concat(referencia_legacy, ':pago:', pago_id)
        end
      ) as referencia_externa
    from pagos_ref
    order by coalesce(completado_en, creado_en) desc
    limit ${limit}
  `;

  const selected = onlyCode
    ? rows.filter((row) => normalizeCode(row.codigo_referido) === onlyCode)
    : rows;

  let sent = 0;
  let duplicates = 0;
  let failed = 0;

  for (const row of selected) {
    const fecha = toDate(row.completado_en || row.creado_en);
    const payload = {
      secret,
      codigoReferido: normalizeCode(row.codigo_referido),
      referenciaExterna: row.referencia_externa,
      cliente: row.pagador_nombre || row.empresa_nombre || "Cliente ARCA",
      clienteEmail: row.pagador_email || row.empresa_email || "",
      empresaCliente: row.empresa_nombre || row.pagador_nombre || "Cliente ARCA",
      plan: `${planName(row.plan_codigo)} ${row.ciclo}`,
      monto: Number(row.monto || 0),
      tipoVenta: row.tipo_comision,
      origen: "pago_paypal_backfill",
      fechaVenta: fecha.toISOString(),
      comprobante: `Pago confirmado en Atria (backfill ${row.pago_id})`,
    };

    if (dryRun) {
      console.log(`[dry-run] ${payload.codigoReferido} ${payload.referenciaExterna} ${payload.plan} $${payload.monto.toFixed(2)} ${payload.tipoVenta}`);
      continue;
    }

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "registrarVentaReferida", payload }),
    });
    const json = await response.json().catch(() => null);
    if (response.ok && json?.ok) {
      sent += 1;
      if (json.data?.duplicada) duplicates += 1;
      await marcarPagoReferido(row.pago_id, "enviado", null);
      continue;
    }

    failed += 1;
    const error = `${json?.code || response.status}: ${json?.error || response.statusText}`;
    await marcarPagoReferido(row.pago_id, "fallido", error);
    console.warn(`[fallo] ${payload.referenciaExterna}: ${error}`);
  }

  console.log(`Referidos revisados: ${selected.length}. Enviados: ${sent}. Duplicados: ${duplicates}. Fallidos: ${failed}.`);
} finally {
  await sql.end();
}

function planName(planCode) {
  if (planCode === "enterprise") return "Enterprise";
  if (planCode === "pro") return "Pro";
  return String(planCode || "Plan");
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 80);
}

async function marcarPagoReferido(pagoId, estado, error) {
  await sql`
    update referidos_pagos
    set
      estado_notificacion = ${estado},
      notificado_en = case when ${estado} = 'enviado' then now() else notificado_en end,
      error_notificacion = ${error},
      actualizado_en = now()
    where pago_suscripcion_id = ${pagoId}
  `;
}

function readArg(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
