import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";
import { once } from "node:events";
import postgres from "postgres";
import { encode } from "@auth/core/jwt";

const databaseUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;

test("ARCA Restaurante mantiene a Nicaris dentro del vertical", { timeout: 300_000 }, async (t) => {
  assert.ok(databaseUrl, "DATABASE_POOL_URL o DATABASE_URL debe estar configurado");
  assert.ok(authSecret, "AUTH_SECRET debe estar configurado");

  const port = await getFreePort();
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = [];
  server.stdout.on("data", (chunk) => output.push(chunk.toString()));
  server.stderr.on("data", (chunk) => output.push(chunk.toString()));
  t.after(() => {
    if (!server.killed) server.kill();
  });

  await waitForServer(`http://127.0.0.1:${port}/login`, output);

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: "require",
  });
  t.after(async () => {
    await sql.end();
  });

  const user = await getNicarisUser(sql);
  const cookie = await buildSessionCookie(user);
  const baseUrl = `http://127.0.0.1:${port}`;
  const get = (path) =>
    fetch(`${baseUrl}${path}`, {
      headers: { cookie },
      redirect: "follow",
    });

  const dashboard = await get("/dashboard");
  const restaurante = await dashboard.text();
  assert.equal(
    dashboard.status,
    200,
    detalleErrorRuta("/dashboard", dashboard, restaurante, output),
  );
  assert.ok(
    dashboard.url.endsWith("/restaurante"),
    `dashboard debe redirigir a /restaurante, finalizo en ${dashboard.url}`,
  );

  assert.match(restaurante, /Operaciones del restaurante/);
  assert.match(restaurante, /Atencion/);
  assert.match(restaurante, /Cocina/);
  assert.match(restaurante, /Reservas/);
  assert.match(restaurante, /Gestion/);
  assert.match(restaurante, /Ventas de hoy/);
  assert.match(restaurante, /Mesas ocupadas/);
  assert.doesNotMatch(restaurante, /Menu virtual<\/span>/);
  assert.doesNotMatch(restaurante, /Pedidos cocina<\/span>/);
  assert.doesNotMatch(restaurante, /seed:nicaris/i);

  const rutas = [
    ["/restaurante/pos", /Comer en el lugar/],
    ["/restaurante/mesas", /Mapa por areas/],
    ["/restaurante/reservaciones", /Nombre del cliente/],
    ["/restaurante/recetas", /Clasificar producto/],
    ["/restaurante/promociones", /Dias de la semana/],
    ["/restaurante/inventario", /Registrar merma/],
    ["/restaurante/configuracion", /Empresa y cuenta/],
    ["/restaurante/empresa", /Vertical de negocio/],
    ["/restaurante/dispositivos", /Dispositivos restaurante/],
    ["/restaurante/plan", /Plan y suscripcion/],
    ["/restaurante/mi-cuenta", /Mi cuenta/],
    ["/restaurante/comensales", /Nuevo comensal/],
    ["/restaurante/soporte", /Soporte ARCA Restaurante/],
  ];

  for (const [path, matcher] of rutas) {
    const response = await get(path);
    const html = await response.text();
    assert.equal(response.status, 200, detalleErrorRuta(path, response, html, output));
    assert.match(html, matcher, `${path} debe renderizar contenido esperado`);
    assert.doesNotMatch(html, /seed:nicaris/i, `${path} no debe exponer marcadores seed`);
    assert.doesNotMatch(
      response.url,
      /\/dashboard/,
      `${path} no debe salir al dashboard principal`,
    );
  }
});

async function getNicarisUser(sql) {
  const [user] = await sql`
    select
      u.id,
      u.email,
      u.nombre,
      u.rol_id,
      u.empresa_id,
      u.es_super_admin,
      r.nombre as rol
    from usuarios u
    inner join empresas e on e.id = u.empresa_id
    left join roles r on r.id = u.rol_id
    where (lower(coalesce(e.nombre_comercial, e.razon_social)) like ${"%nicaris%"}
        or lower(e.razon_social) like ${"%nicaris%"})
      and u.activo = true
      and u.eliminado_en is null
    order by
      case
        when u.es_super_admin then 0
        when lower(r.nombre) = 'administrador' then 1
        else 2
      end,
      u.ultimo_login desc nulls last,
      u.creado_en asc
    limit 1
  `;
  assert.ok(user, "Debe existir un usuario activo de Nicaris para el E2E");
  return user;
}

function detalleErrorRuta(path, response, html, output) {
  return [
    `${path} debe responder 200; recibio ${response.status} en ${response.url}`,
    "HTML:",
    html.slice(0, 3000),
    "Servidor:",
    output.join("").slice(-4000),
  ].join("\n");
}

async function buildSessionCookie(user) {
  const cookieName = "authjs.session-token";
  const token = await encode({
    secret: authSecret,
    salt: cookieName,
    maxAge: 60 * 60,
    token: {
      sub: user.id,
      email: user.email,
      name: user.nombre,
      empresaId: user.empresa_id,
      rolId: user.rol_id,
      esSuperAdmin: user.es_super_admin,
      nombre: user.nombre,
    },
  });
  return `${cookieName}=${token}`;
}

async function getFreePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(url, output) {
  const inicio = Date.now();
  while (Date.now() - inicio < 120_000) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next no inicio a tiempo.\n${output.join("").slice(-4000)}`);
}
