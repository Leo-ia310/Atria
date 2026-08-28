import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";
import { once } from "node:events";
import postgres from "postgres";
import { encode } from "@auth/core/jwt";

const databaseUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;

test("ARCA Restaurante mantiene a Nicaris dentro del vertical", { timeout: 600_000 }, async (t) => {
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
    connect_timeout: 10,
    idle_timeout: 20,
  });
  t.after(async () => {
    await sql.end();
  });

  const user = await withTimeout(getNicarisUser(sql), 25_000, "buscar usuario Nicaris");
  const cookie = await buildSessionCookie(user);
  const baseUrl = `http://127.0.0.1:${port}`;
  const get = (path) => fetchRoute(baseUrl, path, cookie, output);

  t.diagnostic("GET /dashboard");
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
  assert.match(restaurante, /Inventario/);
  assert.match(restaurante, /Compras/);
  assert.match(restaurante, /Finanzas/);
  assert.match(restaurante, /Personal/);
  assert.match(restaurante, /Reservas/);
  assert.match(restaurante, /Administracion/);
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
    ["/restaurante/existencias", /Stock operativo/],
    ["/restaurante/movimientos", /Kardex reciente/],
    ["/restaurante/conteos", /Conteos recientes/],
    ["/restaurante/transferencias", /Traslados recientes/],
    ["/restaurante/compras", /Compras restaurante/],
    ["/restaurante/proveedores", /Proveedores restaurante/],
    ["/restaurante/cxp", /Cuentas por pagar/],
    ["/restaurante/caja", /Turnos y arqueos/],
    ["/restaurante/facturacion", /Facturacion restaurante/],
    ["/restaurante/gastos", /Gastos restaurante/],
    ["/restaurante/tesoreria", /Tesoreria restaurante/],
    ["/restaurante/contabilidad", /Contabilidad restaurante/],
    ["/restaurante/impuestos", /Impuestos restaurante/],
    ["/restaurante/empleados", /Equipo restaurante/],
    ["/restaurante/asistencia", /Asistencia restaurante/],
    ["/restaurante/nomina", /Nomina restaurante/],
    ["/restaurante/delivery", /Delivery y para llevar/],
    ["/restaurante/auditoria", /Auditoria restaurante/],
    ["/restaurante/configuracion", /Empresa y cuenta/],
    ["/restaurante/empresa", /Vertical de negocio/],
    ["/restaurante/dispositivos", /Dispositivos restaurante/],
    ["/restaurante/plan", /Plan y suscripcion/],
    ["/restaurante/mi-cuenta", /Mi cuenta/],
    ["/restaurante/comensales", /Nuevo comensal/],
    ["/restaurante/soporte", /Soporte ARCA Restaurante/],
  ];

  for (const [path, matcher] of rutas) {
    t.diagnostic(`GET ${path}`);
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
    if (path === "/restaurante/pos") {
      assert.match(html, /Carta rapida/, "POS debe tener carta tactil filtrable");
      assert.match(html, /Solicitar cuenta/, "POS debe permitir solicitar cuenta");
      assert.match(html, /Cobrar orden/, "POS debe permitir cobrar orden");
      assert.match(html, /Forma de pago/, "POS debe etiquetar el cobro");
      assert.doesNotMatch(
        html,
        /<select[^>]+name="productoId"/,
        "POS restaurante no debe usar selector viejo de producto",
      );
    }
    if (path === "/restaurante/mesas") {
      assert.match(html, /Ajuste manual/, "Mesas conserva ajuste manual secundario");
      assert.match(
        html,
        /Abrir orden|Ir al POS|Marcar limpia/,
        "Mesas debe exponer acciones operativas",
      );
    }
    if (path === "/restaurante/ordenes") {
      assert.match(html, /Cobrar orden/, "Ordenes debe permitir cierre de cuenta");
      assert.match(html, /Forma de pago/, "Ordenes debe etiquetar el pago");
    }
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

async function fetchRoute(baseUrl, path, cookie, output) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      headers: { cookie },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${path} no respondio en 90s: ${detalle}\nServidor:\n${output.join("").slice(-4000)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} no finalizo en ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function getFreePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const closed = once(server, "close");
  server.close();
  await closed;
  return port;
}

async function waitForServer(url, output) {
  const { hostname, port } = new URL(url);
  const inicio = Date.now();
  while (Date.now() - inicio < 120_000) {
    if (await canConnect(hostname, Number(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next no inicio a tiempo.\n${output.join("").slice(-4000)}`);
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1500);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}
