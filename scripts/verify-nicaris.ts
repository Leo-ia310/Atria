import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

const envPath = fs.existsSync(".env.production.local")
  ? ".env.production.local"
  : ".env";
dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no esta configurada.");

const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });

async function verify() {
  const empresas = await sql<{ id: string; nombre: string }[]>`
    select id, coalesce(nombre_comercial, razon_social) as nombre
    from empresas
    where lower(coalesce(nombre_comercial, '')) = 'nicaris'
       or lower(coalesce(razon_social, '')) like '%nicaris%'
  `;
  if (empresas.length !== 1) {
    throw new Error(`Se esperaba una sola empresa Nicaris y se encontraron ${empresas.length}.`);
  }
  const empresa = empresas[0];

  const [counts] = await sql<Record<string, number>[]>`
    select
      (select count(*)::int from productos where empresa_id = ${empresa.id} and eliminado_en is null) as productos,
      (select count(*)::int from clientes where empresa_id = ${empresa.id} and eliminado_en is null) as clientes,
      (select count(*)::int from proveedores where empresa_id = ${empresa.id} and eliminado_en is null) as proveedores,
      (select count(*)::int from ventas where empresa_id = ${empresa.id}) as ventas,
      (select count(*)::int from facturas where empresa_id = ${empresa.id}) as facturas,
      (select count(*)::int from empleados where empresa_id = ${empresa.id} and eliminado_en is null) as empleados,
      (select count(*)::int from asistencias where empresa_id = ${empresa.id}) as asistencias,
      (select count(*)::int from nomina_colillas where empresa_id = ${empresa.id}) as colillas,
      (select count(*)::int from movimientos_inventario where empresa_id = ${empresa.id}) as movimientos_inventario,
      (select count(*)::int from asientos_contables where empresa_id = ${empresa.id}) as asientos_contables
  `;
  const branches = await sql<{ nombre: string; ventas: number; total: string }[]>`
    select s.nombre, count(v.id)::int as ventas,
           coalesce(sum(v.total), 0)::numeric(14, 2) as total
    from sucursales s
    left join ventas v on v.sucursal_id = s.id
    where s.empresa_id = ${empresa.id} and s.eliminado_en is null
    group by s.id, s.nombre
    order by s.nombre
  `;
  const [integrity] = await sql<Record<string, number>[]>`
    select
      (select count(*)::int from existencias where empresa_id = ${empresa.id} and cantidad < 0) as stock_negativo,
      (select count(*)::int from asientos_contables where empresa_id = ${empresa.id} and abs(total_debe - total_haber) > 0.01) as asientos_descuadrados,
      (select count(*)::int
       from asientos_contables a
       left join lateral (
         select coalesce(sum(p.debe), 0) as debe, coalesce(sum(p.haber), 0) as haber
         from asiento_partidas p where p.asiento_id = a.id
       ) p on true
       where a.empresa_id = ${empresa.id}
         and (abs(p.debe - p.haber) > 0.01 or abs(a.total_debe - p.debe) > 0.01 or abs(a.total_haber - p.haber) > 0.01)) as partidas_descuadradas,
      (select count(*)::int from facturas f left join ventas v on v.id = f.venta_id
       where f.empresa_id = ${empresa.id} and v.id is null) as facturas_huerfanas,
      (select count(*)::int from nominas n
       where n.empresa_id = ${empresa.id} and n.numero like 'DEM-NOM-%'
         and (select count(*) from nomina_detalles d where d.nomina_id = n.id)
           <> (select count(*) from nomina_colillas c where c.nomina_id = n.id)) as nominas_sin_todas_colillas,
      (select count(*)::int from configuraciones
       where empresa_id = ${empresa.id} and clave = 'demo.nicaris.carga_masiva.v1') as marcadores
  `;

  const problems = Object.entries(integrity)
    .filter(([key, value]) => key !== "marcadores" && value !== 0);
  if (integrity.marcadores !== 1) problems.push(["marcadores", integrity.marcadores]);

  console.log(JSON.stringify({ empresa: empresa.nombre, counts, branches, integrity }, null, 2));
  if (problems.length > 0) {
    throw new Error(`La verificacion encontro inconsistencias: ${JSON.stringify(problems)}.`);
  }
}

verify()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
