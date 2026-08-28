import crypto from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_POOL_URL o DATABASE_URL no esta configurado.");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
});

const hoy = new Date();
const hoyISO = hoy.toISOString().slice(0, 10);

const addDays = (days) => {
  const d = new Date(hoy);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const atToday = (hour, minute = 0) => {
  const d = new Date(hoy);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const money = (value) => Number(value).toFixed(4);
const qrHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const LEGACY_SEED_MARKER = "seed:nicaris";

async function main() {
  await sql.begin(async (tx) => {
    const [empresa] = await tx`
      update empresas
      set
        tipo_empresa = 'restaurante',
        vertical_empresa = 'restaurante',
        nombre_comercial = coalesce(nombre_comercial, 'Nicaris'),
        actualizado_en = now()
      where lower(coalesce(nombre_comercial, razon_social)) like ${"%nicaris%"}
         or lower(razon_social) like ${"%nicaris%"}
      returning id, razon_social, nombre_comercial
    `;

    if (!empresa) {
      throw new Error("No encontre la empresa Nicaris.");
    }

    await tx`select set_config('app.empresa_id', ${empresa.id}, true)`;

    const sucursal = await ensureSucursal(tx, empresa.id);
    const almacen = await ensureAlmacen(tx, empresa.id, sucursal.id);
    const usuario = await firstUsuario(tx, empresa.id);
    const unidades = await ensureUnidades(tx, empresa.id);
    const categorias = await ensureCategorias(tx, empresa.id);
    const estaciones = await ensureEstaciones(tx, empresa.id, sucursal.id);
    const areas = await ensureAreas(tx, empresa.id, sucursal.id);
    const mesas = await ensureMesas(tx, empresa.id, sucursal.id, areas);
    const meseros = await ensureMeseros(tx, empresa.id, usuario?.id ?? null);
    const productos = await ensureProductos(
      tx,
      empresa.id,
      categorias,
      unidades,
      estaciones,
      almacen.id,
      usuario?.id ?? null,
    );
    const menu = await ensureMenu(tx, empresa.id, sucursal.id, usuario?.id ?? null);
    await ensureMenuPlatillos(tx, empresa.id, menu.id, productos);
    const comensales = await ensureComensales(tx, empresa.id);

    await resetSeedTransaccional(tx, empresa.id);
    await ensureOrdenesDemo(
      tx,
      empresa.id,
      sucursal.id,
      usuario?.id ?? null,
      mesas,
      meseros,
      comensales,
      productos,
      estaciones,
    );
    await ensureRecepcionDemo(tx, empresa.id, sucursal.id, usuario?.id ?? null, mesas, comensales);
    await ensureMarketingDemo(tx, empresa.id, usuario?.id ?? null, productos, categorias);
    await ensureMermasDemo(tx, empresa.id, sucursal.id, almacen.id, usuario?.id ?? null, productos);
    await ensureFidelizacionDemo(tx, empresa.id, usuario?.id ?? null);

    console.log(
      JSON.stringify(
        {
          empresa: empresa.nombre_comercial || empresa.razon_social,
          sucursal: sucursal.nombre,
          areas: Object.keys(areas).length,
          mesas: Object.keys(mesas).length,
          estaciones: Object.keys(estaciones).length,
          productos: Object.keys(productos).length,
          menu: menu.nombre,
        },
        null,
        2,
      ),
    );
  });
}

async function ensureSucursal(tx, empresaId) {
  const [principal] = await tx`
    select id, codigo, nombre
    from sucursales
    where empresa_id = ${empresaId}
      and activa = true
      and eliminado_en is null
    order by es_principal desc, creado_en asc
    limit 1
  `;
  if (principal) return principal;

  const [creada] = await tx`
    insert into sucursales (empresa_id, codigo, nombre, direccion, telefono, es_principal, activa)
    values (${empresaId}, 'PRIN', 'Sucursal Principal', 'Managua, Nicaragua', '+505 2222 1000', true, true)
    returning id, codigo, nombre
  `;
  return creada;
}

async function ensureAlmacen(tx, empresaId, sucursalId) {
  const [actual] = await tx`
    select id, codigo, nombre
    from almacenes
    where empresa_id = ${empresaId}
      and sucursal_id = ${sucursalId}
      and activo = true
    order by es_principal desc, codigo asc
    limit 1
  `;
  if (actual) return actual;

  const [creado] = await tx`
    insert into almacenes (empresa_id, sucursal_id, codigo, nombre, es_principal, activo)
    values (${empresaId}, ${sucursalId}, 'REST-PRIN', 'Bodega cocina principal', true, true)
    on conflict (empresa_id, codigo) do update
      set nombre = excluded.nombre, sucursal_id = excluded.sucursal_id, activo = true
    returning id, codigo, nombre
  `;
  return creado;
}

async function firstUsuario(tx, empresaId) {
  const [usuario] = await tx`
    select id, nombre
    from usuarios
    where empresa_id = ${empresaId}
      and activo = true
      and eliminado_en is null
    order by ultimo_login desc nulls last, creado_en asc
    limit 1
  `;
  return usuario ?? null;
}

async function ensureUnidades(tx, empresaId) {
  const data = [
    ["UND", "Unidad"],
    ["KG", "Kilogramo"],
    ["G", "Gramo"],
    ["LT", "Litro"],
    ["ML", "Mililitro"],
  ];
  const out = {};
  for (const [codigo, nombre] of data) {
    const [row] = await tx`
      insert into unidades_medida (empresa_id, codigo, nombre, es_base)
      values (${empresaId}, ${codigo}, ${nombre}, ${codigo === "UND"})
      on conflict (empresa_id, codigo) do update
        set nombre = excluded.nombre
      returning id, codigo
    `;
    out[codigo] = row.id;
  }
  return out;
}

async function ensureCategorias(tx, empresaId) {
  const names = ["Platos Nicaris", "Entradas", "Bebidas", "Postres", "Insumos cocina"];
  const out = {};
  for (const nombre of names) {
    let [row] = await tx`
      select id, nombre
      from categorias
      where empresa_id = ${empresaId}
        and lower(nombre) = lower(${nombre})
      limit 1
    `;
    if (!row) {
      [row] = await tx`
        insert into categorias (empresa_id, nombre, descripcion, activa)
        values (${empresaId}, ${nombre}, ${`Categoria demo para ${nombre}`}, true)
        returning id, nombre
      `;
    }
    out[nombre] = row.id;
  }
  return out;
}

async function ensureEstaciones(tx, empresaId, sucursalId) {
  const data = [
    { nombre: "Cocina caliente", tipo: "cocina", orden: 1 },
    { nombre: "Parrilla", tipo: "parrilla", orden: 2 },
    { nombre: "Barra fria", tipo: "bar", orden: 3 },
    { nombre: "Postres", tipo: "postres", orden: 4 },
  ];
  const out = {};
  for (const item of data) {
    const [row] = await tx`
      insert into restaurante_estaciones (empresa_id, sucursal_id, nombre, tipo, activa, orden)
      values (${empresaId}, ${sucursalId}, ${item.nombre}, ${item.tipo}, true, ${item.orden})
      on conflict (empresa_id, sucursal_id, nombre) do update
        set tipo = excluded.tipo, activa = true, orden = excluded.orden, actualizado_en = now()
      returning id, nombre
    `;
    out[item.nombre] = row.id;
  }
  return out;
}

async function ensureAreas(tx, empresaId, sucursalId) {
  const data = [
    ["Salon principal", 1],
    ["Terraza", 2],
    ["Barra", 3],
    ["Reservado", 4],
  ];
  const out = {};
  for (const [nombre, orden] of data) {
    const [row] = await tx`
      insert into restaurante_areas (empresa_id, sucursal_id, nombre, orden, activa)
      values (${empresaId}, ${sucursalId}, ${nombre}, ${orden}, true)
      on conflict (empresa_id, sucursal_id, nombre) do update
        set orden = excluded.orden, activa = true, actualizado_en = now()
      returning id, nombre
    `;
    out[nombre] = row.id;
  }
  return out;
}

async function ensureMesas(tx, empresaId, sucursalId, areas) {
  const data = [
    ["M1", "Salon principal", 4, "ocupada", "rectangular", 0.18, 0.22],
    ["M2", "Salon principal", 4, "ocupada", "rectangular", 0.38, 0.22],
    ["M3", "Salon principal", 2, "disponible", "cuadrada", 0.58, 0.22],
    ["M4", "Salon principal", 6, "cuenta_solicitada", "rectangular", 0.78, 0.22],
    ["M5", "Salon principal", 4, "por_limpiar", "redonda", 0.22, 0.48],
    ["M6", "Terraza", 4, "reservada", "redonda", 0.48, 0.52],
    ["M7", "Terraza", 2, "disponible", "cuadrada", 0.68, 0.52],
    ["M8", "Terraza", 6, "ocupada", "rectangular", 0.86, 0.52],
    ["B1", "Barra", 1, "ocupada", "barra", 0.18, 0.78],
    ["B2", "Barra", 1, "disponible", "barra", 0.34, 0.78],
    ["B3", "Barra", 1, "disponible", "barra", 0.50, 0.78],
    ["R1", "Reservado", 8, "reservada", "rectangular", 0.74, 0.78],
  ];
  const out = {};
  for (const [nombre, area, capacidad, estado, forma, posX, posY] of data) {
    const token = `nicaris-${sucursalId}-${nombre}`;
    const [row] = await tx`
      insert into restaurante_mesas (
        empresa_id, sucursal_id, area_id, nombre, capacidad, pos_x, pos_y,
        ancho, alto, forma, estado, qr_token_hash, qr_token_ultimos4
      )
      values (
        ${empresaId}, ${sucursalId}, ${areas[area]}, ${nombre}, ${capacidad}, ${posX},
        ${posY}, ${forma === "barra" ? 0.1 : 0.14}, ${forma === "barra" ? 0.08 : 0.1},
        ${forma}, ${estado}, ${qrHash(token)}, ${token.slice(-4)}
      )
      on conflict (empresa_id, sucursal_id, nombre) do update
        set
          area_id = excluded.area_id,
          capacidad = excluded.capacidad,
          pos_x = excluded.pos_x,
          pos_y = excluded.pos_y,
          forma = excluded.forma,
          estado = excluded.estado,
          qr_token_hash = excluded.qr_token_hash,
          qr_token_ultimos4 = excluded.qr_token_ultimos4,
          actualizado_en = now()
      returning id, nombre
    `;
    out[nombre] = row.id;
  }
  return out;
}

async function ensureMeseros(tx, empresaId, usuarioId) {
  const data = [
    ["MES-01", "Fernanda"],
    ["MES-02", "Kevin"],
    ["MES-03", "Maikel"],
  ];
  const out = {};
  for (const [codigo, nombrePublico] of data) {
    const [row] = await tx`
      insert into restaurante_meseros (empresa_id, usuario_id, codigo, nombre_publico, activo, metas)
      values (${empresaId}, ${codigo === "MES-03" ? usuarioId : null}, ${codigo}, ${nombrePublico}, true, ${JSON.stringify({ mesas: 4 })}::jsonb)
      on conflict (empresa_id, codigo) do update
        set nombre_publico = excluded.nombre_publico, activo = true, actualizado_en = now()
      returning id, codigo
    `;
    out[codigo] = row.id;
  }
  return out;
}

async function ensureProductos(tx, empresaId, categorias, unidades, estaciones, almacenId, usuarioId) {
  const productos = {};
  const insumos = [
    {
      key: "carne",
      sku: "NIC-INS-CARNE",
      nombre: "Carne de res premium",
      unidad: "KG",
      costo: 178,
      minimo: 25,
      stock: 18,
      vence: addDays(10),
    },
    {
      key: "pollo",
      sku: "NIC-INS-POLLO",
      nombre: "Pollo marinado",
      unidad: "KG",
      costo: 112,
      minimo: 18,
      stock: 12,
      vence: addDays(8),
    },
    {
      key: "queso",
      sku: "NIC-INS-QUESO",
      nombre: "Queso ahumado",
      unidad: "KG",
      costo: 145,
      minimo: 8,
      stock: 6,
      vence: addDays(5),
    },
    {
      key: "lechuga",
      sku: "NIC-INS-LECHUGA",
      nombre: "Lechuga romana",
      unidad: "KG",
      costo: 42,
      minimo: 5,
      stock: 3.5,
      vence: addDays(4),
    },
    {
      key: "pan",
      sku: "NIC-INS-PAN",
      nombre: "Pan artesanal brioche",
      unidad: "UND",
      costo: 18,
      minimo: 40,
      stock: 28,
      vence: addDays(2),
    },
    {
      key: "cafe",
      sku: "NIC-INS-CAFE",
      nombre: "Cafe molido Matagalpa",
      unidad: "KG",
      costo: 210,
      minimo: 6,
      stock: 9,
      vence: addDays(45),
    },
    {
      key: "salsa",
      sku: "NIC-INS-SALSA",
      nombre: "Salsa de la casa",
      unidad: "LT",
      costo: 65,
      minimo: 6,
      stock: 7,
      vence: addDays(7),
    },
  ];

  for (const item of insumos) {
    const row = await upsertProducto(tx, {
      empresaId,
      sku: item.sku,
      nombre: item.nombre,
      descripcion: "Insumo demo de cocina Nicaris",
      categoriaId: categorias["Insumos cocina"],
      unidadId: unidades[item.unidad],
      precio: 0,
      costo: item.costo,
      minimo: item.minimo,
      vence: item.vence,
    });
    await upsertRestauranteProducto(tx, empresaId, row.id, "insumo", null, false, true, 0, [], ["stock"]);
    await ensureExistencia(tx, empresaId, row.id, almacenId, item.stock);
    productos[item.key] = row;
  }

  const platillos = [
    {
      key: "hamburguesa",
      sku: "NIC-PLT-HAMB",
      nombre: "Hamburguesa Nicaris",
      descripcion: "Brioche, res premium, queso ahumado y salsa de la casa.",
      categoria: "Platos Nicaris",
      precio: 295,
      costo: 110,
      estacion: "Parrilla",
      tiempo: 14,
      tags: ["favorito", "parrilla"],
      ingredientes: [
        ["carne", 0.22, 178],
        ["pan", 1, 18],
        ["queso", 0.04, 145],
        ["salsa", 0.03, 65],
      ],
    },
    {
      key: "tacos",
      sku: "NIC-PLT-TACOS",
      nombre: "Tacos de ribeye",
      descripcion: "Tortillas suaves, ribeye, encurtido y crema de aguacate.",
      categoria: "Platos Nicaris",
      precio: 260,
      costo: 94,
      estacion: "Cocina caliente",
      tiempo: 12,
      tags: ["nuevo"],
      ingredientes: [
        ["carne", 0.16, 178],
        ["salsa", 0.04, 65],
      ],
    },
    {
      key: "pollo",
      sku: "NIC-PLT-POLLO",
      nombre: "Pollo jalapeno grill",
      descripcion: "Pechuga marinada, vegetales salteados y pure rustico.",
      categoria: "Platos Nicaris",
      precio: 225,
      costo: 78,
      estacion: "Parrilla",
      tiempo: 16,
      tags: ["picante"],
      ingredientes: [
        ["pollo", 0.24, 112],
        ["salsa", 0.05, 65],
      ],
    },
    {
      key: "ensalada",
      sku: "NIC-PLT-ENS",
      nombre: "Ensalada tropical",
      descripcion: "Lechuga, queso ahumado, frutas de temporada y vinagreta.",
      categoria: "Entradas",
      precio: 190,
      costo: 62,
      estacion: "Barra fria",
      tiempo: 8,
      tags: ["ligero"],
      ingredientes: [
        ["lechuga", 0.18, 42],
        ["queso", 0.03, 145],
      ],
    },
    {
      key: "cheesecake",
      sku: "NIC-POS-CHEESE",
      nombre: "Cheesecake de maracuya",
      descripcion: "Porcion individual con coulis de maracuya.",
      categoria: "Postres",
      precio: 145,
      costo: 48,
      estacion: "Postres",
      tiempo: 5,
      tags: ["postre"],
      ingredientes: [["queso", 0.05, 145]],
    },
    {
      key: "cafeFrio",
      sku: "NIC-BEB-CAFEFRIO",
      nombre: "Cafe frio cacao",
      descripcion: "Cafe Matagalpa, cacao y leche.",
      categoria: "Bebidas",
      precio: 110,
      costo: 35,
      estacion: "Barra fria",
      tiempo: 6,
      tags: ["bebida"],
      ingredientes: [["cafe", 0.03, 210]],
    },
    {
      key: "limonada",
      sku: "NIC-BEB-LIMON",
      nombre: "Limonada hierbabuena",
      descripcion: "Limonada fresca con hierbabuena y hielo.",
      categoria: "Bebidas",
      precio: 85,
      costo: 22,
      estacion: "Barra fria",
      tiempo: 4,
      tags: ["bebida"],
      ingredientes: [["salsa", 0.01, 65]],
    },
  ];

  for (const item of platillos) {
    const row = await upsertProducto(tx, {
      empresaId,
      sku: item.sku,
      nombre: item.nombre,
      descripcion: item.descripcion,
      categoriaId: categorias[item.categoria],
      unidadId: unidades.UND,
      precio: item.precio,
      costo: item.costo,
      minimo: 0,
      vence: null,
    });
    await upsertRestauranteProducto(
      tx,
      empresaId,
      row.id,
      "platillo",
      estaciones[item.estacion],
      true,
      true,
      item.tiempo,
      [],
      item.tags,
    );
    const receta = await upsertReceta(tx, empresaId, row.id, row.nombre, item.costo, item.precio, usuarioId);
    await tx`delete from restaurante_receta_ingredientes where empresa_id = ${empresaId} and receta_id = ${receta.id}`;
    for (const [ingredienteKey, cantidad, costoUnitario] of item.ingredientes) {
      await tx`
        insert into restaurante_receta_ingredientes (
          empresa_id, receta_id, ingrediente_producto_id, unidad_id, cantidad,
          costo_unitario, merma_pct, notas
        )
        values (
          ${empresaId}, ${receta.id}, ${productos[ingredienteKey].id},
          ${unidades.KG}, ${cantidad}, ${money(costoUnitario)}, '0.0500',
          null
        )
      `;
    }
    productos[item.key] = row;
  }

  return productos;
}

async function upsertProducto(tx, item) {
  const [row] = await tx`
    insert into productos (
      empresa_id, sku, nombre, descripcion, categoria_id, unidad_base_id,
      precio_base, costo_promedio, stock_minimo, fecha_vencimiento, activo, eliminado_en
    )
    values (
      ${item.empresaId}, ${item.sku}, ${item.nombre}, ${item.descripcion},
      ${item.categoriaId}, ${item.unidadId}, ${money(item.precio)},
      ${money(item.costo)}, ${money(item.minimo)}, ${item.vence}, true, null
    )
    on conflict (empresa_id, sku) do update
      set
        nombre = excluded.nombre,
        descripcion = excluded.descripcion,
        categoria_id = excluded.categoria_id,
        unidad_base_id = excluded.unidad_base_id,
        precio_base = excluded.precio_base,
        costo_promedio = excluded.costo_promedio,
        stock_minimo = excluded.stock_minimo,
        fecha_vencimiento = excluded.fecha_vencimiento,
        activo = true,
        eliminado_en = null,
        actualizado_en = now()
    returning id, sku, nombre, precio_base, costo_promedio
  `;
  return row;
}

async function upsertRestauranteProducto(
  tx,
  empresaId,
  productoId,
  tipo,
  estacionId,
  disponibleQr,
  consumeInventario,
  tiempo,
  alergenos,
  etiquetas,
) {
  await tx`
    insert into restaurante_productos (
      empresa_id, producto_id, tipo, estacion_id, disponible_qr,
      consume_inventario, tiempo_preparacion_min, alergenos, etiquetas
    )
    values (
      ${empresaId}, ${productoId}, ${tipo}, ${estacionId}, ${disponibleQr},
      ${consumeInventario}, ${tiempo}, ${alergenos}::text[], ${etiquetas}::text[]
    )
    on conflict (empresa_id, producto_id) do update
      set
        tipo = excluded.tipo,
        estacion_id = excluded.estacion_id,
        disponible_qr = excluded.disponible_qr,
        consume_inventario = excluded.consume_inventario,
        tiempo_preparacion_min = excluded.tiempo_preparacion_min,
        alergenos = excluded.alergenos,
        etiquetas = excluded.etiquetas,
        actualizado_en = now()
  `;
}

async function ensureExistencia(tx, empresaId, productoId, almacenId, cantidad) {
  const [actual] = await tx`
    select id
    from existencias
    where empresa_id = ${empresaId}
      and producto_id = ${productoId}
      and almacen_id = ${almacenId}
      and lote_id is null
    limit 1
  `;
  if (actual) {
    await tx`
      update existencias
      set cantidad = ${money(cantidad)}, actualizado_en = now()
      where id = ${actual.id}
    `;
    return;
  }
  await tx`
    insert into existencias (empresa_id, producto_id, almacen_id, lote_id, cantidad, cantidad_reservada)
    values (${empresaId}, ${productoId}, ${almacenId}, null, ${money(cantidad)}, '0.0000')
  `;
}

async function upsertReceta(tx, empresaId, productoId, nombre, costo, precio, usuarioId) {
  const foodCostPct = precio > 0 ? (costo / precio) * 100 : 0;
  const [row] = await tx`
    insert into restaurante_recetas (
      empresa_id, producto_id, nombre, tipo, rendimiento_cantidad,
      costo_total, costo_por_porcion, precio_venta, food_cost_pct, activa, creado_por
    )
    values (
      ${empresaId}, ${productoId}, ${nombre}, 'platillo', '1.0000',
      ${money(costo)}, ${money(costo)}, ${money(precio)}, ${money(foodCostPct)}, true, ${usuarioId}
    )
    on conflict (empresa_id, producto_id) do update
      set
        nombre = excluded.nombre,
        costo_total = excluded.costo_total,
        costo_por_porcion = excluded.costo_por_porcion,
        precio_venta = excluded.precio_venta,
        food_cost_pct = excluded.food_cost_pct,
        activa = true,
        actualizado_en = now()
    returning id
  `;
  return row;
}

async function ensureMenu(tx, empresaId, sucursalId, usuarioId) {
  const [row] = await tx`
    insert into menus_virtuales (
      empresa_id, sucursal_id, cantidad_mesas, nombre, slug, descripcion, plantilla,
      color_primario, color_secundario, color_fondo, telefono, whatsapp,
      instagram_url, sitio_web_url, animaciones, publicado, creado_por
    )
    values (
      ${empresaId}, ${sucursalId}, 12, 'Carta Nicaris', 'nicaris-arca-restaurante',
      'Menu demo de Nicaris para revisar ARCA Restaurante con datos reales.',
      'bistro', '#5b3df5', '#22c55e', '#f8fafc', '+505 2222 1000',
      '+505 8888 1000', 'https://instagram.com/nicaris', 'https://arca.onl',
      true, true, ${usuarioId}
    )
    on conflict (slug) do update
      set
        empresa_id = excluded.empresa_id,
        sucursal_id = excluded.sucursal_id,
        cantidad_mesas = excluded.cantidad_mesas,
        nombre = excluded.nombre,
        descripcion = excluded.descripcion,
        telefono = excluded.telefono,
        whatsapp = excluded.whatsapp,
        publicado = true,
        actualizado_en = now()
    returning id, nombre
  `;
  return row;
}

async function ensureMenuPlatillos(tx, empresaId, menuId, productos) {
  const secciones = [
    ["Entradas", "Para abrir mesa o compartir.", 1],
    ["Platos fuertes", "Favoritos de la casa.", 2],
    ["Bebidas", "Barra fria y cafe.", 3],
    ["Postres", "Cierre dulce.", 4],
  ];
  const seccionIds = {};
  for (const [nombre, descripcion, orden] of secciones) {
    let [row] = await tx`
      select id
      from menu_secciones
      where empresa_id = ${empresaId}
        and menu_id = ${menuId}
        and lower(nombre) = lower(${nombre})
      limit 1
    `;
    if (row) {
      await tx`
        update menu_secciones
        set descripcion = ${descripcion}, orden = ${orden}, visible = true
        where id = ${row.id}
      `;
    } else {
      [row] = await tx`
        insert into menu_secciones (empresa_id, menu_id, nombre, descripcion, orden, visible)
        values (${empresaId}, ${menuId}, ${nombre}, ${descripcion}, ${orden}, true)
        returning id
      `;
    }
    seccionIds[nombre] = row.id;
  }

  const items = [
    [productos.ensalada, "Entradas", true, null, 1],
    [productos.hamburguesa, "Platos fuertes", true, "Mas vendido", 1],
    [productos.tacos, "Platos fuertes", true, "Nuevo", 2],
    [productos.pollo, "Platos fuertes", false, null, 3],
    [productos.cafeFrio, "Bebidas", true, null, 1],
    [productos.limonada, "Bebidas", false, "Refrescante", 2],
    [productos.cheesecake, "Postres", true, "Favorito", 1],
  ];

  for (const [producto, seccion, destacado, etiquetaOferta, orden] of items) {
    const precio = Number(producto.precio_base);
    let [row] = await tx`
      select id
      from menu_platillos
      where empresa_id = ${empresaId}
        and menu_id = ${menuId}
        and lower(nombre) = lower(${producto.nombre})
      limit 1
    `;
    if (row) {
      await tx`
        update menu_platillos
        set
          seccion_id = ${seccionIds[seccion]},
          producto_id = ${producto.id},
          descripcion = ${producto.nombre === "Hamburguesa Nicaris" ? "Brioche, res premium y queso ahumado." : "Platillo destacado de Nicaris."},
          precio = ${money(precio)},
          precio_oferta = ${etiquetaOferta ? money(precio * 0.9) : null},
          etiqueta_oferta = ${etiquetaOferta},
          destacado = ${destacado},
          disponible = true,
          orden = ${orden},
          actualizado_en = now()
        where id = ${row.id}
      `;
    } else {
      await tx`
        insert into menu_platillos (
          empresa_id, menu_id, seccion_id, producto_id, nombre, descripcion,
          precio, precio_oferta, etiqueta_oferta, destacado, disponible, orden
        )
        values (
          ${empresaId}, ${menuId}, ${seccionIds[seccion]}, ${producto.id},
          ${producto.nombre}, 'Platillo destacado de Nicaris.',
          ${money(precio)}, ${etiquetaOferta ? money(precio * 0.9) : null},
          ${etiquetaOferta}, ${destacado}, true, ${orden}
        )
      `;
    }
  }
}

async function ensureComensales(tx, empresaId) {
  const data = [
    ["Lucia Hernandez", "+50588101001", "lucia@nicaris.demo", 12, 8460, "Sin cebolla", "Ninguna"],
    ["Carlos Mejia", "+50588101002", "carlos@nicaris.demo", 8, 5120, "Mesa terraza", "Mani"],
    ["Andrea Solis", "+50588101003", "andrea@nicaris.demo", 16, 11180, "Postre favorito", "Ninguna"],
    ["Roberto Vega", "+50588101004", "roberto@nicaris.demo", 5, 2780, "Cafe al final", "Lactosa"],
    ["Familia Ruiz", "+50588101005", "ruiz@nicaris.demo", 9, 7240, "Silla de bebe", "Ninguna"],
  ];
  const out = {};
  for (const [nombre, telefono, email, visitas, gasto, preferencias, alergias] of data) {
    const [row] = await tx`
      insert into restaurante_comensales (
        empresa_id, nombre, telefono, email, visitas, gasto_historico,
        ticket_promedio, ultima_visita_en, platillos_frecuentes,
        preferencias, alergias, notas, ocasiones_especiales
      )
      values (
        ${empresaId}, ${nombre}, ${telefono}, ${email}, ${visitas},
        ${money(gasto)}, ${money(gasto / visitas)}, ${atToday(13, 20)},
        ${JSON.stringify([{ nombre: "Hamburguesa Nicaris" }, { nombre: "Cafe frio cacao" }])}::jsonb,
        ${preferencias}, ${alergias}, null, 'Cumpleanos y cenas familiares'
      )
      on conflict (empresa_id, email) do update
        set
          nombre = excluded.nombre,
          telefono = excluded.telefono,
          visitas = excluded.visitas,
          gasto_historico = excluded.gasto_historico,
          ticket_promedio = excluded.ticket_promedio,
          ultima_visita_en = excluded.ultima_visita_en,
          platillos_frecuentes = excluded.platillos_frecuentes,
          preferencias = excluded.preferencias,
          alergias = excluded.alergias,
          notas = excluded.notas,
          actualizado_en = now()
      returning id, nombre, email
    `;
    out[nombre] = row.id;
  }
  return out;
}

async function resetSeedTransaccional(tx, empresaId) {
  await tx`
    delete from restaurante_visitas_comensal
    where empresa_id = ${empresaId}
      and metadata->>'seed' = 'nicaris'
  `;
  await tx`
    delete from restaurante_ordenes
    where empresa_id = ${empresaId}
      and idempotency_key like 'nicaris-demo-%'
  `;
  await tx`
    delete from ventas
    where empresa_id = ${empresaId}
      and numero like 'NIC-DEMO-%'
  `;
  await tx`
    delete from restaurante_reservaciones
    where empresa_id = ${empresaId}
      and (notas like ${`${LEGACY_SEED_MARKER}%`} or email like '%@nicaris.demo')
  `;
  await tx`
    delete from restaurante_lista_espera
    where empresa_id = ${empresaId}
      and (notas like ${`${LEGACY_SEED_MARKER}%`} or telefono like '+505881020%')
  `;
  await tx`
    delete from restaurante_mermas
    where empresa_id = ${empresaId}
      and (
        observacion like ${`${LEGACY_SEED_MARKER}%`}
        or observacion in (
          'corte de hojas para mise en place',
          'panes vencidos antes de servicio'
        )
      )
  `;
  await tx`
    delete from restaurante_promociones
    where empresa_id = ${empresaId}
      and reglas->>'seed' = 'nicaris'
  `;
  await tx`
    delete from restaurante_compras_sugeridas
    where empresa_id = ${empresaId}
      and estado = ${LEGACY_SEED_MARKER}
  `;
}

async function ensureOrdenesDemo(
  tx,
  empresaId,
  sucursalId,
  usuarioId,
  mesas,
  meseros,
  comensales,
  productos,
  estaciones,
) {
  const ordenes = [
    {
      n: 1,
      mesa: "M1",
      mesero: "MES-01",
      comensal: "Lucia Hernandez",
      estado: "en_cocina",
      personas: 3,
      hora: [12, 15],
      items: [
        ["hamburguesa", 2, "preparando"],
        ["limonada", 3, "listo"],
      ],
      comandaEstado: "preparando",
      estacion: "Parrilla",
    },
    {
      n: 2,
      mesa: "M2",
      mesero: "MES-02",
      comensal: "Carlos Mejia",
      estado: "abierta",
      personas: 2,
      hora: [12, 42],
      items: [
        ["tacos", 2, "enviado"],
        ["cafeFrio", 2, "enviado"],
      ],
      comandaEstado: "recibida",
      estacion: "Cocina caliente",
    },
    {
      n: 3,
      mesa: "M4",
      mesero: "MES-03",
      comensal: "Andrea Solis",
      estado: "cuenta_solicitada",
      personas: 4,
      hora: [13, 5],
      items: [
        ["pollo", 3, "entregado"],
        ["cheesecake", 2, "entregado"],
      ],
      comandaEstado: "entregada",
      estacion: "Parrilla",
    },
    {
      n: 4,
      mesa: "M8",
      mesero: "MES-01",
      comensal: "Familia Ruiz",
      estado: "en_cocina",
      personas: 5,
      hora: [13, 18],
      items: [
        ["ensalada", 2, "preparando"],
        ["hamburguesa", 3, "preparando"],
      ],
      comandaEstado: "enviada",
      estacion: "Cocina caliente",
    },
    {
      n: 5,
      mesa: "B1",
      mesero: "MES-02",
      comensal: "Roberto Vega",
      estado: "abierta",
      personas: 1,
      hora: [14, 5],
      items: [
        ["cafeFrio", 1, "listo"],
        ["cheesecake", 1, "enviado"],
      ],
      comandaEstado: "lista",
      estacion: "Barra fria",
    },
    {
      n: 6,
      mesa: "M6",
      mesero: "MES-03",
      comensal: "Lucia Hernandez",
      estado: "pagada",
      personas: 2,
      hora: [10, 55],
      items: [
        ["pollo", 2, "entregado"],
        ["limonada", 2, "entregado"],
      ],
      venta: true,
      comandaEstado: "entregada",
      estacion: "Parrilla",
    },
    {
      n: 7,
      mesa: "M3",
      mesero: "MES-01",
      comensal: "Andrea Solis",
      estado: "pagada",
      personas: 2,
      hora: [11, 35],
      items: [
        ["hamburguesa", 1, "entregado"],
        ["tacos", 1, "entregado"],
        ["cafeFrio", 2, "entregado"],
      ],
      venta: true,
      comandaEstado: "entregada",
      estacion: "Cocina caliente",
    },
    {
      n: 8,
      mesa: "R1",
      mesero: "MES-02",
      comensal: "Familia Ruiz",
      estado: "pagada",
      personas: 6,
      hora: [15, 10],
      items: [
        ["ensalada", 2, "entregado"],
        ["tacos", 4, "entregado"],
        ["cheesecake", 4, "entregado"],
      ],
      venta: true,
      comandaEstado: "entregada",
      estacion: "Cocina caliente",
    },
  ];

  for (const orden of ordenes) {
    const subtotal = orden.items.reduce(
      (sum, [key, cantidad]) => sum + Number(productos[key].precio_base) * cantidad,
      0,
    );
    const costo = orden.items.reduce(
      (sum, [key, cantidad]) => sum + Number(productos[key].costo_promedio) * cantidad,
      0,
    );
    const impuesto = subtotal * 0.15;
    const propina = subtotal * 0.1;
    const total = subtotal + impuesto + propina;
    const ventaId = orden.venta
      ? await insertVentaDemo(tx, empresaId, sucursalId, usuarioId, orden.n, subtotal, impuesto, total, costo, orden.hora)
      : null;

    const [ordenRow] = await tx`
      insert into restaurante_ordenes (
        empresa_id, sucursal_id, mesa_id, mesero_id, comensal_id, venta_id,
        numero, canal, estado, personas, subtotal, impuesto, propina, total,
        notas, idempotency_key, abierto_por, abierto_en, cuenta_solicitada_en, cerrado_en
      )
      values (
        ${empresaId}, ${sucursalId}, ${mesas[orden.mesa]}, ${meseros[orden.mesero]},
        ${comensales[orden.comensal]}, ${ventaId}, ${`R-${hoyISO.replaceAll("-", "")}-${String(orden.n).padStart(3, "0")}`},
        'salon', ${orden.estado}, ${orden.personas}, ${money(subtotal)}, ${money(impuesto)},
        ${money(propina)}, ${money(total)}, null,
        ${`nicaris-demo-order-${orden.n}`}, ${usuarioId}, ${atToday(...orden.hora)},
        ${orden.estado === "cuenta_solicitada" ? atToday(15, 35) : null},
        ${orden.estado === "pagada" ? atToday(orden.hora[0] + 1, orden.hora[1]) : null}
      )
      returning id
    `;

    const itemRows = [];
    for (const [key, cantidad, estado] of orden.items) {
      const producto = productos[key];
      const precio = Number(producto.precio_base);
      const costoUnitario = Number(producto.costo_promedio);
      const [itemRow] = await tx`
        insert into restaurante_orden_items (
          empresa_id, orden_id, producto_id, nombre_snapshot, cantidad,
          precio_unitario, impuesto, costo_unitario, estado, notas_cocina,
          enviado_cocina_en
        )
        values (
          ${empresaId}, ${ordenRow.id}, ${producto.id}, ${producto.nombre},
          ${money(cantidad)}, ${money(precio)}, ${money(precio * cantidad * 0.15)},
          ${money(costoUnitario)}, ${estado}, null, ${atToday(...orden.hora)}
        )
        returning id, producto_id, nombre_snapshot, cantidad
      `;
      itemRows.push(itemRow);
    }

    const [comanda] = await tx`
      insert into restaurante_comandas (
        empresa_id, sucursal_id, orden_id, estacion_id, numero, estado, prioridad,
        notas, enviada_por, enviada_en, recibida_en, preparando_en, lista_en, entregada_en
      )
      values (
        ${empresaId}, ${sucursalId}, ${ordenRow.id}, ${estaciones[orden.estacion]},
        ${`K-${hoyISO.replaceAll("-", "")}-${String(orden.n).padStart(3, "0")}`},
        ${orden.comandaEstado}, ${orden.n <= 2 ? 2 : 1}, null,
        ${usuarioId}, ${atToday(...orden.hora)},
        ${["recibida", "preparando", "lista", "entregada"].includes(orden.comandaEstado) ? atToday(orden.hora[0], orden.hora[1] + 3) : null},
        ${["preparando", "lista", "entregada"].includes(orden.comandaEstado) ? atToday(orden.hora[0], orden.hora[1] + 7) : null},
        ${["lista", "entregada"].includes(orden.comandaEstado) ? atToday(orden.hora[0], orden.hora[1] + 18) : null},
        ${orden.comandaEstado === "entregada" ? atToday(orden.hora[0], orden.hora[1] + 23) : null}
      )
      returning id
    `;

    for (const item of itemRows) {
      await tx`
        insert into restaurante_comanda_items (
          empresa_id, comanda_id, orden_item_id, producto_id, nombre_snapshot,
          cantidad, notas_cocina, estado
        )
        values (
          ${empresaId}, ${comanda.id}, ${item.id}, ${item.producto_id},
          ${item.nombre_snapshot}, ${item.cantidad}, null, ${orden.comandaEstado}
        )
      `;
    }

    if (orden.venta) {
      await tx`
        insert into restaurante_visitas_comensal (
          empresa_id, comensal_id, orden_id, venta_id, canal, visitado_en, metadata
        )
        values (
          ${empresaId}, ${comensales[orden.comensal]}, ${ordenRow.id}, ${ventaId},
          'salon', ${atToday(orden.hora[0], orden.hora[1] + 30)},
          ${JSON.stringify({ seed: "nicaris" })}::jsonb
        )
      `;
    }
  }
}

async function insertVentaDemo(tx, empresaId, sucursalId, usuarioId, numero, subtotal, impuesto, total, costo, hora) {
  const [venta] = await tx`
    insert into ventas (
      empresa_id, sucursal_id, numero, fecha, estado, es_credito,
      subtotal, impuesto, total, costo_total, notas, usuario_id
    )
    values (
      ${empresaId}, ${sucursalId}, ${`NIC-DEMO-${String(numero).padStart(3, "0")}`},
      ${atToday(...hora)}, 'completada', false, ${money(subtotal)}, ${money(impuesto)},
      ${money(total)}, ${money(costo)}, 'Venta restaurante Nicaris', ${usuarioId}
    )
    returning id
  `;
  return venta.id;
}

async function ensureRecepcionDemo(tx, empresaId, sucursalId, usuarioId, mesas, comensales) {
  const reservas = [
    ["Lucia Hernandez", "+50588101001", "lucia@nicaris.demo", addDays(0), "19:00", 4, "Cumpleanos", "M6"],
    ["Carlos Mejia", "+50588101002", "carlos@nicaris.demo", addDays(0), "20:30", 2, "Cena rapida", "M3"],
    ["Andrea Solis", "+50588101003", "andrea@nicaris.demo", addDays(1), "18:45", 5, "Aniversario", "R1"],
    ["Familia Ruiz", "+50588101005", "ruiz@nicaris.demo", addDays(2), "12:30", 6, "Almuerzo familiar", "M8"],
  ];
  for (const [nombre, telefono, email, fecha, hora, personas, ocasion, mesa] of reservas) {
    await tx`
      insert into restaurante_reservaciones (
        empresa_id, sucursal_id, comensal_id, mesa_id, nombre, telefono, email,
        fecha, hora, personas, ocasion_especial, notas, estado, deposito_monto, creado_por
      )
      values (
        ${empresaId}, ${sucursalId}, ${comensales[nombre]}, ${mesas[mesa]},
        ${nombre}, ${telefono}, ${email}, ${fecha}, ${hora}, ${personas},
        ${ocasion}, null, 'confirmada', ${money(personas * 100)},
        ${usuarioId}
      )
    `;
  }

  const espera = [
    ["Mesa para dos", "+50588102001", 2, 18, "Terraza"],
    ["Grupo Ortega", "+50588102002", 5, 25, "Salon principal"],
    ["Barra express", "+50588102003", 1, 8, "Barra"],
  ];
  for (const [nombre, telefono, personas, min, preferencia] of espera) {
    await tx`
      insert into restaurante_lista_espera (
        empresa_id, sucursal_id, nombre, telefono, personas, llegada_en,
        espera_estimada_min, preferencia, notas, estado, creado_por
      )
      values (
        ${empresaId}, ${sucursalId}, ${nombre}, ${telefono}, ${personas},
        ${atToday(18, 10)}, ${min}, ${preferencia}, null,
        'esperando', ${usuarioId}
      )
    `;
  }
}

async function ensureMarketingDemo(tx, empresaId, usuarioId, productos, categorias) {
  const promos = [
    ["Hora verde", "15% en ensalada tropical de 3pm a 5pm", "porcentaje", 15, productos.ensalada.id],
    ["Combo cafe y postre", "Cafe frio cacao + cheesecake a precio especial", "precio_fijo", 225, productos.cafeFrio.id],
    ["Noche de tacos", "2x1 en tacos de ribeye martes y jueves", "dos_por_uno", 0, productos.tacos.id],
  ];
  for (const [nombre, descripcion, tipo, valor, productoId] of promos) {
    await tx`
      insert into restaurante_promociones (
        empresa_id, nombre, descripcion, tipo, valor, producto_id, categoria_id,
        dias_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin, cliente_segmento,
        activa, reglas, creado_por
      )
      values (
        ${empresaId}, ${nombre}, ${descripcion}, ${tipo}, ${money(valor)},
        ${productoId}, ${categorias["Platos Nicaris"]}, ${[1, 2, 3, 4, 5]}::integer[],
        '15:00', '22:00', ${hoyISO}, ${addDays(30)}, 'Frecuentes',
        true, ${JSON.stringify({ seed: "nicaris" })}::jsonb, ${usuarioId}
      )
    `;
  }
}

async function ensureMermasDemo(tx, empresaId, sucursalId, almacenId, usuarioId, productos) {
  const rows = [
    [productos.lechuga.id, 0.7, 42, "preparacion", "corte de hojas para mise en place"],
    [productos.pan.id, 4, 18, "caducidad", "panes vencidos antes de servicio"],
  ];
  for (const [productoId, cantidad, costo, motivo, observacion] of rows) {
    await tx`
      insert into restaurante_mermas (
        empresa_id, sucursal_id, almacen_id, producto_id, cantidad,
        costo_unitario, motivo, observacion, creado_por, fecha
      )
      values (
        ${empresaId}, ${sucursalId}, ${almacenId}, ${productoId}, ${money(cantidad)},
        ${money(costo)}, ${motivo}, ${observacion}, ${usuarioId}, ${atToday(9, 20)}
      )
    `;
  }
}

async function ensureFidelizacionDemo(tx, empresaId, usuarioId) {
  await tx`
    insert into restaurante_fidelizacion_config (
      empresa_id, puntos_por_monto, monto_base, reglas, activa, actualizado_por
    )
    values (
      ${empresaId}, '1.0000', '50.0000',
      ${JSON.stringify({ vencimientoDias: 180, seed: "nicaris" })}::jsonb,
      true, ${usuarioId}
    )
    on conflict (empresa_id) do update
      set
        puntos_por_monto = excluded.puntos_por_monto,
        monto_base = excluded.monto_base,
        reglas = excluded.reglas,
        activa = true,
        actualizado_por = excluded.actualizado_por,
        actualizado_en = now()
  `;
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
