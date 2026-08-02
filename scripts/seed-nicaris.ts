import fs from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";

const EXECUTE_FLAG = "--execute";
const MARKER_KEY = "demo.nicaris.carga_masiva.v1";
const TARGET_NAME = "nicaris";

if (!process.argv.includes(EXECUTE_FLAG)) {
  throw new Error(
    `Carga cancelada. Ejecuta este script con ${EXECUTE_FLAG} para confirmar la escritura.`,
  );
}

const envPath = fs.existsSync(".env.production.local")
  ? ".env.production.local"
  : ".env";
dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no esta configurada.");

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 2,
  connect_timeout: 15,
  idle_timeout: 20,
});

let randomState = 0x4e494341;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function int(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateAt(date: string, hour: number, minute = 0): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-06:00`);
}

type AnyRow = Record<string, unknown>;

async function seed() {
  const empresas = await sql<
    { id: string; razon_social: string; nombre_comercial: string | null; pais: string; moneda: string }[]
  >`
    select id, razon_social, nombre_comercial, pais, moneda
    from empresas
    where lower(coalesce(nombre_comercial, '')) = ${TARGET_NAME}
       or lower(coalesce(razon_social, '')) like ${`%${TARGET_NAME}%`}
  `;

  if (empresas.length !== 1) {
    throw new Error(`Se esperaba una sola empresa Nicaris y se encontraron ${empresas.length}.`);
  }

  const empresa = empresas[0];
  const sucursales = await sql<
    { id: string; codigo: string; nombre: string; es_principal: boolean }[]
  >`
    select id, codigo, nombre, es_principal
    from sucursales
    where empresa_id = ${empresa.id} and activa = true and eliminado_en is null
    order by es_principal desc, codigo
  `;
  if (sucursales.length !== 2) {
    throw new Error(`Nicaris debe tener exactamente 2 sucursales activas; tiene ${sucursales.length}.`);
  }

  const usuarios = await sql<{ id: string; nombre: string }[]>`
    select id, nombre from usuarios
    where empresa_id = ${empresa.id} and activo = true
    order by creado_en
  `;
  if (usuarios.length === 0) throw new Error("Nicaris no tiene usuarios activos.");

  const summary = await sql.begin(async (tx) => {
    const [marker] = await tx<{ valor: unknown }[]>`
      select valor from configuraciones
      where empresa_id = ${empresa.id} and clave = ${MARKER_KEY}
      limit 1
    `;
    if (marker) {
      throw new Error("La carga masiva de Nicaris ya fue ejecutada. No se insertaron duplicados.");
    }

    const bulkInsert = async (table: string, rows: AnyRow[], columns: string[]) => {
      if (rows.length === 0) return;
      await tx`insert into ${tx(table)} ${tx(rows, ...columns)}`;
    };

    const empresaId = empresa.id;
    const usuarioIds = usuarios.map((usuario) => usuario.id);
    const branchById = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal]));

    const cuentas = await tx<{ id: string; codigo: string }[]>`
      select id, codigo from catalogo_cuentas where empresa_id = ${empresaId}
    `;
    const cuentaByCode = new Map(cuentas.map((cuenta) => [cuenta.codigo, cuenta.id]));
    for (const codigo of ["1101", "1103", "1104", "1105", "1106", "2101", "2102", "2103", "2104", "4101", "5101", "6101"]) {
      if (!cuentaByCode.has(codigo)) throw new Error(`Falta la cuenta contable ${codigo}.`);
    }

    const periodByMonth = new Map<number, string>();
    for (let month = 2; month <= 7; month += 1) {
      const [existing] = await tx<{ id: string }[]>`
        select id from periodos_contables
        where empresa_id = ${empresaId} and anio = 2026 and mes = ${month}
        limit 1
      `;
      if (existing) {
        periodByMonth.set(month, existing.id);
        continue;
      }
      const id = randomUUID();
      const start = new Date(Date.UTC(2026, month - 1, 1));
      const end = new Date(Date.UTC(2026, month, 0));
      await tx`
        insert into periodos_contables
          (id, empresa_id, anio, mes, fecha_inicio, fecha_fin, estado)
        values
          (${id}, ${empresaId}, 2026, ${month}, ${isoDate(start)}, ${isoDate(end)}, 'abierto')
      `;
      periodByMonth.set(month, id);
    }

    const unitRows = await tx<{ id: string; codigo: string }[]>`
      select id, codigo from unidades_medida where empresa_id = ${empresaId} order by es_base desc
    `;
    let unidadBaseId = unitRows[0]?.id;
    if (!unidadBaseId) {
      unidadBaseId = randomUUID();
      await tx`
        insert into unidades_medida (id, empresa_id, codigo, nombre, es_base)
        values (${unidadBaseId}, ${empresaId}, 'UND', 'Unidad', true)
      `;
    }
    const unidadCajaId = randomUUID();
    await tx`
      insert into unidades_medida (id, empresa_id, codigo, nombre, es_base)
      values (${unidadCajaId}, ${empresaId}, 'CJD', 'Caja demo', false)
      on conflict (empresa_id, codigo) do nothing
    `;
    const [unidadCaja] = await tx<{ id: string }[]>`
      select id from unidades_medida where empresa_id = ${empresaId} and codigo = 'CJD' limit 1
    `;

    const [impuestoExistente] = await tx<{ id: string; tasa: string }[]>`
      select id, tasa from impuestos where empresa_id = ${empresaId} and activo = true order by tasa desc limit 1
    `;
    let impuestoId = impuestoExistente?.id;
    let impuestoTasa = Number(impuestoExistente?.tasa ?? 0.15);
    if (!impuestoId) {
      impuestoId = randomUUID();
      impuestoTasa = 0.15;
      await tx`
        insert into impuestos (id, empresa_id, nombre, codigo, tasa, es_retencion, activo)
        values (${impuestoId}, ${empresaId}, 'IVA 15%', 'IVA15', '0.15', false, true)
      `;
    }

    const categoryNames = [
      "Bebidas", "Abarrotes", "Snacks", "Lacteos", "Higiene personal",
      "Limpieza", "Panaderia", "Congelados", "Hogar", "Servicios",
    ];
    const categoryRows = categoryNames.map((nombre, index) => ({
      id: randomUUID(),
      empresa_id: empresaId,
      nombre,
      descripcion: `Categoria de demostracion ${index + 1} para Nicaris`,
      activa: true,
    }));
    await bulkInsert("categorias", categoryRows, ["id", "empresa_id", "nombre", "descripcion", "activa"]);
    const categoryId = new Map(categoryRows.map((row) => [String(row.nombre), String(row.id)]));

    const brandNames = [
      "NicaFresh", "Buen Dia", "Tropico", "Selecto", "La Granja", "Puro Hogar",
      "Rico Rico", "Vital", "Familia", "MaxClean", "Dulce Vida", "Campo Real",
    ];
    const brandRows = brandNames.map((nombre) => ({
      id: randomUUID(), empresa_id: empresaId, nombre, activa: true,
    }));
    await bulkInsert("marcas", brandRows, ["id", "empresa_id", "nombre", "activa"]);

    const productNamesByCategory: Record<string, string[]> = {
      Bebidas: [
        "Agua purificada 600 ml", "Agua purificada 1.5 L", "Gaseosa cola 355 ml",
        "Gaseosa naranja 355 ml", "Bebida energetica 473 ml", "Jugo de naranja 1 L",
        "Jugo de manzana 1 L", "Cafe molido 250 g", "Te frio limon 500 ml",
      ],
      Abarrotes: [
        "Arroz nacional 1 lb", "Frijol rojo 1 lb", "Azucar 1 lb", "Aceite vegetal 1 L",
        "Harina de trigo 1 lb", "Sal refinada 500 g", "Pasta espagueti 400 g",
        "Salsa de tomate 200 g", "Atun en lata 140 g", "Avena en hojuelas 400 g",
      ],
      Snacks: [
        "Papas clasicas 45 g", "Papas picantes 45 g", "Tortillitas 50 g",
        "Galletas de vainilla", "Galletas de chocolate", "Barra de cereal",
        "Mani salado 100 g", "Chocolate con leche 40 g", "Caramelo surtido 100 g",
      ],
      Lacteos: [
        "Leche entera 1 L", "Leche descremada 1 L", "Yogur fresa 200 ml",
        "Yogur natural 1 L", "Queso seco 1 lb", "Crema acida 250 ml",
        "Mantequilla 200 g",
      ],
      "Higiene personal": [
        "Jabon de bano", "Shampoo familiar 400 ml", "Pasta dental 90 ml",
        "Cepillo dental suave", "Desodorante roll-on", "Papel higienico 4 rollos",
        "Toallas sanitarias 10 unidades",
      ],
      Limpieza: [
        "Detergente en polvo 500 g", "Jabon para platos 500 ml", "Cloro 1 L",
        "Desinfectante lavanda 1 L", "Suavizante 1 L", "Esponja multiuso",
        "Bolsa para basura 10 unidades",
      ],
      Panaderia: [
        "Pan molde blanco", "Pan integral", "Rosquillas 12 unidades",
        "Galleta de avena artesanal", "Queque individual",
      ],
      Congelados: [
        "Pollo entero congelado", "Pechuga de pollo 1 lb", "Carne molida 1 lb",
        "Helado vainilla 1 L", "Vegetales mixtos 500 g",
      ],
      Hogar: [
        "Fosforos 10 cajas", "Vela blanca 4 unidades", "Pilas AA 4 unidades",
        "Vaso desechable 25 unidades", "Plato desechable 25 unidades",
      ],
    };

    const productRows: AnyRow[] = [];
    let productIndex = 0;
    for (const [category, names] of Object.entries(productNamesByCategory)) {
      for (const nombre of names) {
        productIndex += 1;
        const costo = round(12 + (productIndex % 11) * 4.75 + int(0, 12));
        const precio = round(costo * (1.28 + (productIndex % 5) * 0.04), 2);
        productRows.push({
          id: randomUUID(),
          empresa_id: empresaId,
          sku: `NIC-${String(productIndex).padStart(4, "0")}`,
          codigo_barras: `7401000${String(productIndex).padStart(6, "0")}`,
          nombre,
          descripcion: `${nombre}. Producto de demostracion con rotacion frecuente.`,
          tipo: "simple",
          categoria_id: categoryId.get(category),
          marca_id: brandRows[productIndex % brandRows.length].id,
          unidad_base_id: unidadBaseId,
          impuesto_id: impuestoId,
          precio_base: precio,
          costo_promedio: costo,
          stock_minimo: 15 + (productIndex % 10),
          stock_maximo: 400,
          metodo_costeo: productIndex % 8 === 0 ? "fifo" : "promedio",
          maneja_lotes: productIndex <= 6,
          maneja_series: false,
          activo: true,
        });
      }
    }

    const serviceRows = [
      ["Recarga telefonica", 100],
      ["Pago de servicios", 25],
      ["Entrega a domicilio", 80],
    ].map(([nombre, precio], index) => ({
      id: randomUUID(), empresa_id: empresaId,
      sku: `NIC-SRV-${index + 1}`, codigo_barras: null, nombre,
      descripcion: "Servicio disponible en ambas sucursales",
      tipo: "servicio", categoria_id: categoryId.get("Servicios"), marca_id: null,
      unidad_base_id: unidadBaseId, impuesto_id: impuestoId, precio_base: precio,
      costo_promedio: 0, stock_minimo: 0, stock_maximo: null, metodo_costeo: "promedio",
      maneja_lotes: false, maneja_series: false, activo: true,
    }));
    const comboRows = ["Combo desayuno", "Combo merienda", "Combo familiar"].map((nombre, index) => ({
      id: randomUUID(), empresa_id: empresaId, sku: `NIC-CMB-${index + 1}`,
      codigo_barras: null, nombre,
      descripcion: "Combo promocional de demostracion", tipo: "combo",
      categoria_id: categoryId.get("Snacks"), marca_id: brandRows[index].id,
      unidad_base_id: unidadBaseId, impuesto_id: impuestoId,
      precio_base: 95 + index * 70, costo_promedio: 62 + index * 48,
      stock_minimo: 0, stock_maximo: null, metodo_costeo: "promedio",
      maneja_lotes: false, maneja_series: false, activo: true,
    }));
    productRows.push(...serviceRows, ...comboRows);
    await bulkInsert("productos", productRows, [
      "id", "empresa_id", "sku", "codigo_barras", "nombre", "descripcion", "tipo",
      "categoria_id", "marca_id", "unidad_base_id", "impuesto_id", "precio_base",
      "costo_promedio", "stock_minimo", "stock_maximo", "metodo_costeo", "maneja_lotes",
      "maneja_series", "activo",
    ]);

    const simpleProducts = productRows.filter((row) => row.tipo === "simple");
    const saleProducts = [...simpleProducts];
    const allProductIds = productRows.map((row) => String(row.id));
    const productById = new Map(productRows.map((row) => [String(row.id), row]));

    const productUnitRows: AnyRow[] = [];
    for (const product of productRows) {
      productUnitRows.push({
        id: randomUUID(), producto_id: product.id, unidad_id: unidadBaseId,
        factor: 1, es_venta: true, es_compra: true,
      });
      if (Number(String(product.sku).replace(/\D/g, "")) % 5 === 0) {
        productUnitRows.push({
          id: randomUUID(), producto_id: product.id, unidad_id: unidadCaja.id,
          factor: 12, es_venta: true, es_compra: true,
        });
      }
    }
    await bulkInsert("producto_unidades", productUnitRows, [
      "id", "producto_id", "unidad_id", "factor", "es_venta", "es_compra",
    ]);

    const componentRows: AnyRow[] = [];
    comboRows.forEach((combo, comboIndex) => {
      for (let offset = 0; offset < 3; offset += 1) {
        componentRows.push({
          id: randomUUID(), producto_padre_id: combo.id,
          componente_id: simpleProducts[comboIndex * 3 + offset].id,
          cantidad: 1,
        });
      }
    });
    await bulkInsert("producto_componentes", componentRows, [
      "id", "producto_padre_id", "componente_id", "cantidad",
    ]);

    const [defaultPriceList] = await tx<{ id: string }[]>`
      select id from listas_precios where empresa_id = ${empresaId} and es_default = true limit 1
    `;
    const retailListId = defaultPriceList?.id ?? randomUUID();
    if (!defaultPriceList) {
      await tx`
        insert into listas_precios (id, empresa_id, nombre, descripcion, es_default, activa)
        values (${retailListId}, ${empresaId}, 'Precio regular', 'Lista principal', true, true)
      `;
    }
    const wholesaleListId = randomUUID();
    await tx`
      insert into listas_precios (id, empresa_id, nombre, descripcion, es_default, activa)
      values (${wholesaleListId}, ${empresaId}, 'Mayorista demo', 'Precios por volumen', false, true)
    `;
    const priceRows = productRows.flatMap((product) => [
      { id: randomUUID(), lista_id: retailListId, producto_id: product.id, precio: product.precio_base, vigente_desde: "2026-01-01" },
      { id: randomUUID(), lista_id: wholesaleListId, producto_id: product.id, precio: round(Number(product.precio_base) * 0.92), vigente_desde: "2026-01-01" },
    ]);
    await bulkInsert("precios", priceRows, ["id", "lista_id", "producto_id", "precio", "vigente_desde"]);

    const lotRows = simpleProducts.slice(0, 6).map((product, index) => ({
      id: randomUUID(), empresa_id: empresaId, producto_id: product.id,
      numero: `LOT-NIC-${String(index + 1).padStart(3, "0")}`,
      fecha_fabricacion: "2026-05-15", fecha_vencimiento: `2027-${String((index % 6) + 1).padStart(2, "0")}-28`,
    }));
    await bulkInsert("lotes", lotRows, [
      "id", "empresa_id", "producto_id", "numero", "fecha_fabricacion", "fecha_vencimiento",
    ]);
    const lotByProduct = new Map(lotRows.map((row) => [String(row.producto_id), String(row.id)]));

    const warningRows = simpleProducts.slice(10, 16).map((product, index) => ({
      id: randomUUID(), empresa_id: empresaId, producto_id: product.id, fila_excel: 12 + index,
      campo: index % 2 === 0 ? "nombre" : "descripcion",
      mensaje: index % 2 === 0 ? "Nombre completado automaticamente durante la importacion" : "Descripcion pendiente de revision",
      valor_original: index % 2 === 0 ? "" : "Dato abreviado en archivo de origen",
      resuelta: index < 2,
    }));
    await bulkInsert("producto_advertencias", warningRows, [
      "id", "empresa_id", "producto_id", "fila_excel", "campo", "mensaje", "valor_original", "resuelta",
    ]);

    const supplierNames = [
      "Distribuidora Centroamericana", "Alimentos del Pacifico", "Bebidas de Nicaragua",
      "Lacteos La Hacienda", "Productos Selectos Managua", "Comercial San Cristobal",
      "Higiene y Hogar S.A.", "Importadora El Mayoreo", "Congelados del Norte",
      "Panificadora Tradicion", "Abastecedora Nacional", "Empaques y Mas",
    ];
    const supplierRows = supplierNames.map((nombre, index) => ({
      id: randomUUID(), empresa_id: empresaId, razon_social: `${nombre} DEMO`,
      nombre_comercial: nombre, identificacion_fiscal: `J-DEMO-${String(index + 1).padStart(4, "0")}`,
      email: `proveedor${index + 1}@example.test`, telefono: `0000-${String(2000 + index).padStart(4, "0")}`,
      direccion: index % 2 === 0 ? "Managua, Nicaragua" : "Masaya, Nicaragua",
      dias_credito: [0, 15, 30, 45][index % 4], contacto: `Contacto demo ${index + 1}`,
      notas: "Proveedor generado para datos de demostracion", activo: true,
    }));
    await bulkInsert("proveedores", supplierRows, [
      "id", "empresa_id", "razon_social", "nombre_comercial", "identificacion_fiscal",
      "email", "telefono", "direccion", "dias_credito", "contacto", "notas", "activo",
    ]);

    const firstNames = [
      "Carlos", "Maria", "Jose", "Ana", "Luis", "Sofia", "Jorge", "Daniela", "Miguel", "Valeria",
      "Roberto", "Gabriela", "Fernando", "Lucia", "Oscar", "Paola", "Ricardo", "Elena", "Andres", "Camila",
    ];
    const lastNames = [
      "Lopez", "Martinez", "Gonzalez", "Hernandez", "Ramirez", "Castillo", "Mendoza", "Rojas",
      "Ruiz", "Torres", "Espinoza", "Vargas", "Navarro", "Perez", "Sanchez", "Morales",
    ];
    const customerRows = Array.from({ length: 80 }, (_, index) => ({
      id: randomUUID(), empresa_id: empresaId,
      nombre: `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`,
      identificacion_fiscal: `DEMO-CLI-${String(index + 1).padStart(4, "0")}`,
      email: `cliente${index + 1}@example.test`, telefono: `0000-${String(3000 + index).padStart(4, "0")}`,
      direccion: pick(["Managua", "Bello Horizonte", "Ciudad Sandino", "Tipitapa", "Masaya"]),
      limite_credito: index % 3 === 0 ? 15000 + index * 250 : 0,
      dias_credito: index % 3 === 0 ? 30 : 0,
      lista_precio_id: index % 5 === 0 ? wholesaleListId : retailListId,
      es_consumidor_final: false, notas: "Cliente de demostracion Nicaris", activo: true,
    }));
    await bulkInsert("clientes", customerRows, [
      "id", "empresa_id", "nombre", "identificacion_fiscal", "email", "telefono", "direccion",
      "limite_credito", "dias_credito", "lista_precio_id", "es_consumidor_final", "notas", "activo",
    ]);

    const financialRows = sucursales.map((sucursal, index) => ({
      id: randomUUID(), empresa_id: empresaId, sucursal_id: sucursal.id,
      tipo: index === 0 ? "banco" : "wallet",
      nombre: index === 0 ? "Banco operativo demo" : "Billetera digital demo",
      banco: index === 0 ? "Banco Demo Nicaragua" : "Pago Movil",
      numero_cuenta: `DEMO-${index + 1}-0001`, moneda: "NIO",
      saldo_actual: index === 0 ? 485000 : 126000,
      cuenta_contable_id: cuentaByCode.get(index === 0 ? "1103" : "1101"), activa: true,
    }));
    await bulkInsert("cuentas_financieras", financialRows, [
      "id", "empresa_id", "sucursal_id", "tipo", "nombre", "banco", "numero_cuenta",
      "moneda", "saldo_actual", "cuenta_contable_id", "activa",
    ]);

    const warehouseRows = await tx<{ id: string; sucursal_id: string }[]>`
      select id, sucursal_id from almacenes
      where empresa_id = ${empresaId} and activo = true and sucursal_id is not null
    `;
    const warehouseByBranch = new Map(warehouseRows.map((row) => [row.sucursal_id, row.id]));
    for (const sucursal of sucursales) {
      if (!warehouseByBranch.has(sucursal.id)) {
        const id = randomUUID();
        await tx`
          insert into almacenes (id, empresa_id, sucursal_id, codigo, nombre, es_principal, activo)
          values (${id}, ${empresaId}, ${sucursal.id}, ${`DEM-${sucursal.codigo}`}, ${`Almacen ${sucursal.nombre}`}, true, true)
        `;
        warehouseByBranch.set(sucursal.id, id);
      }
    }

    const cashRegisters = await tx<{ id: string; sucursal_id: string }[]>`
      select id, sucursal_id from cajas where empresa_id = ${empresaId} and activa = true
    `;
    const cashRegisterByBranch = new Map(cashRegisters.map((row) => [row.sucursal_id, row.id]));
    for (const sucursal of sucursales) {
      if (!cashRegisterByBranch.has(sucursal.id)) {
        const id = randomUUID();
        await tx`
          insert into cajas (id, empresa_id, sucursal_id, codigo, nombre, cuenta_financiera_id, activa)
          values (${id}, ${empresaId}, ${sucursal.id}, ${`DEM-CJ-${sucursal.codigo}`}, ${`Caja ${sucursal.nombre}`}, ${financialRows[0].id}, true)
        `;
        cashRegisterByBranch.set(sucursal.id, id);
      }
    }

    const paymentForms = await tx<{ id: string; codigo: string; nombre: string }[]>`
      select id, codigo, nombre from formas_pago where empresa_id = ${empresaId} and activa = true
    `;
    const paymentByCode = new Map(paymentForms.map((form) => [form.codigo, form]));
    for (const required of ["EFE", "TAR", "TRA", "CRE"]) {
      if (!paymentByCode.has(required)) throw new Error(`Falta la forma de pago ${required}.`);
    }

    const costCenterRows = sucursales.map((sucursal, index) => ({
      id: randomUUID(), empresa_id: empresaId, codigo: `CC-DEM-${index + 1}`,
      nombre: `Centro de costo ${sucursal.nombre}`, activo: true,
    }));
    costCenterRows.push({
      id: randomUUID(), empresa_id: empresaId, codigo: "CC-DEM-ADM",
      nombre: "Administracion central", activo: true,
    });
    await bulkInsert("centros_costo", costCenterRows, ["id", "empresa_id", "codigo", "nombre", "activo"]);

    const stockByProductWarehouse = new Map<string, number>();
    const inventoryMovementRows: AnyRow[] = [];
    const stockKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;
    const changeStock = (productId: string, warehouseId: string, quantity: number) => {
      const key = stockKey(productId, warehouseId);
      stockByProductWarehouse.set(key, round((stockByProductWarehouse.get(key) ?? 0) + quantity, 4));
    };

    for (const product of simpleProducts) {
      for (const sucursal of sucursales) {
        const warehouseId = warehouseByBranch.get(sucursal.id)!;
        const quantity = 220 + int(0, 100);
        changeStock(String(product.id), warehouseId, quantity);
        inventoryMovementRows.push({
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id,
          almacen_id: warehouseId, lote_id: lotByProduct.get(String(product.id)) ?? null,
          tipo: "ajuste_entrada", cantidad: quantity, costo_unitario: product.costo_promedio,
          referencia_tabla: "carga_demo", referencia_id: null,
          notas: "Existencia inicial de demostracion Nicaris", usuario_id: pick(usuarioIds),
          creado_en: dateAt("2026-04-01", 8),
        });
      }
    }

    const purchaseOrderRows: AnyRow[] = [];
    const purchaseOrderDetailRows: AnyRow[] = [];
    const purchaseOrdersMeta: { id: string; branchId: string; supplierId: string }[] = [];
    const purchaseStart = new Date(Date.UTC(2026, 3, 2));
    for (let index = 0; index < 36; index += 1) {
      const id = randomUUID();
      const branch = sucursales[index % sucursales.length];
      const supplier = supplierRows[index % supplierRows.length];
      const fecha = isoDate(addDays(purchaseStart, index * 3));
      const items: AnyRow[] = [];
      const used = new Set<string>();
      while (items.length < 3 + (index % 3)) {
        const product = pick(simpleProducts);
        if (used.has(String(product.id))) continue;
        used.add(String(product.id));
        const quantity = 12 + int(0, 30);
        const cost = round(Number(product.costo_promedio) * (0.96 + random() * 0.08));
        const base = round(quantity * cost);
        items.push({
          id: randomUUID(), orden_id: id, producto_id: product.id, cantidad: quantity,
          cantidad_recibida: index % 5 === 0 ? 0 : quantity,
          costo_unitario: cost, impuesto: round(base * impuestoTasa), subtotal: base,
        });
      }
      const subtotal = round(items.reduce((sum, item) => sum + Number(item.subtotal), 0));
      const tax = round(items.reduce((sum, item) => sum + Number(item.impuesto), 0));
      purchaseOrderRows.push({
        id, empresa_id: empresaId, sucursal_id: branch.id, proveedor_id: supplier.id,
        numero: `DEM-OC-${String(index + 1).padStart(4, "0")}`, fecha,
        fecha_esperada: isoDate(addDays(new Date(`${fecha}T12:00:00Z`), 5 + (index % 8))),
        estado: index % 6 === 0 ? "enviada" : index % 7 === 0 ? "parcial" : "recibida",
        subtotal, impuesto: tax, total: round(subtotal + tax),
        notas: "Orden de compra de demostracion", usuario_id: pick(usuarioIds),
      });
      purchaseOrderDetailRows.push(...items);
      purchaseOrdersMeta.push({ id, branchId: branch.id, supplierId: String(supplier.id) });
    }
    await bulkInsert("ordenes_compra", purchaseOrderRows, [
      "id", "empresa_id", "sucursal_id", "proveedor_id", "numero", "fecha", "fecha_esperada",
      "estado", "subtotal", "impuesto", "total", "notas", "usuario_id",
    ]);
    await bulkInsert("orden_compra_detalle", purchaseOrderDetailRows, [
      "id", "orden_id", "producto_id", "cantidad", "cantidad_recibida", "costo_unitario",
      "impuesto", "subtotal",
    ]);

    const purchaseRows: AnyRow[] = [];
    const purchaseDetailRows: AnyRow[] = [];
    const payableRows: AnyRow[] = [];
    const supplierPaymentRows: AnyRow[] = [];
    const purchaseAccounting: { id: string; fecha: string; subtotal: number; tax: number; total: number; credit: boolean }[] = [];
    for (let index = 0; index < 30; index += 1) {
      const id = randomUUID();
      const order = purchaseOrdersMeta[index];
      const branchId = order.branchId;
      const warehouseId = warehouseByBranch.get(branchId)!;
      const fecha = isoDate(addDays(purchaseStart, index * 4 + 2));
      const details: AnyRow[] = [];
      const used = new Set<string>();
      while (details.length < 4 + (index % 3)) {
        const product = pick(simpleProducts);
        if (used.has(String(product.id))) continue;
        used.add(String(product.id));
        const quantity = 15 + int(0, 40);
        const cost = round(Number(product.costo_promedio) * (0.95 + random() * 0.1));
        const base = round(quantity * cost);
        details.push({
          id: randomUUID(), compra_id: id, producto_id: product.id,
          lote_id: lotByProduct.get(String(product.id)) ?? null,
          cantidad: quantity, costo_unitario: cost,
          impuesto: round(base * impuestoTasa), subtotal: base,
        });
        changeStock(String(product.id), warehouseId, quantity);
        inventoryMovementRows.push({
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id,
          almacen_id: warehouseId, lote_id: lotByProduct.get(String(product.id)) ?? null,
          tipo: "entrada_compra", cantidad: quantity, costo_unitario: cost,
          referencia_tabla: "compras", referencia_id: id,
          notas: "Entrada por compra de demostracion", usuario_id: pick(usuarioIds),
          creado_en: dateAt(fecha, 10, 15),
        });
      }
      const subtotal = round(details.reduce((sum, item) => sum + Number(item.subtotal), 0));
      const tax = round(details.reduce((sum, item) => sum + Number(item.impuesto), 0));
      const total = round(subtotal + tax);
      const credit = index % 3 !== 0;
      purchaseRows.push({
        id, empresa_id: empresaId, sucursal_id: branchId, almacen_id: warehouseId,
        proveedor_id: order.supplierId, orden_id: order.id,
        numero_factura: `DEM-CMP-${String(index + 1).padStart(4, "0")}`,
        fecha, estado: "recibida", es_credito: credit, dias_credito: credit ? 30 : 0,
        fecha_vencimiento: credit ? isoDate(addDays(new Date(`${fecha}T12:00:00Z`), 30)) : null,
        subtotal, impuesto: tax, retencion: 0, total,
        notas: "Compra recibida para carga demostrativa", usuario_id: pick(usuarioIds),
      });
      purchaseDetailRows.push(...details);
      purchaseAccounting.push({ id, fecha, subtotal, tax, total, credit });

      if (credit) {
        const payableId = randomUUID();
        const paymentMode = index % 4;
        const paid = paymentMode === 0 ? total : paymentMode === 1 ? round(total * 0.45) : 0;
        const balance = round(total - paid);
        payableRows.push({
          id: payableId, empresa_id: empresaId, proveedor_id: order.supplierId,
          compra_id: id, fecha_emision: fecha,
          fecha_vencimiento: isoDate(addDays(new Date(`${fecha}T12:00:00Z`), 30)),
          monto: total, saldo: balance,
          estado: balance === 0 ? "pagada" : paid > 0 ? "parcial" : index < 8 ? "vencida" : "pendiente",
          notas: "Cuenta por pagar de demostracion",
        });
        if (paid > 0) {
          supplierPaymentRows.push({
            id: randomUUID(), empresa_id: empresaId, cxp_id: payableId,
            cuenta_financiera_id: financialRows[0].id,
            fecha: isoDate(addDays(new Date(`${fecha}T12:00:00Z`), 12)), monto: paid,
            referencia: `DEM-PROV-${String(index + 1).padStart(4, "0")}`,
            notas: "Abono demostrativo a proveedor", usuario_id: pick(usuarioIds),
          });
        }
      }
    }
    await bulkInsert("compras", purchaseRows, [
      "id", "empresa_id", "sucursal_id", "almacen_id", "proveedor_id", "orden_id",
      "numero_factura", "fecha", "estado", "es_credito", "dias_credito", "fecha_vencimiento",
      "subtotal", "impuesto", "retencion", "total", "notas", "usuario_id",
    ]);
    await bulkInsert("compra_detalle", purchaseDetailRows, [
      "id", "compra_id", "producto_id", "lote_id", "cantidad", "costo_unitario", "impuesto", "subtotal",
    ]);
    await bulkInsert("cuentas_por_pagar", payableRows, [
      "id", "empresa_id", "proveedor_id", "compra_id", "fecha_emision", "fecha_vencimiento",
      "monto", "saldo", "estado", "notas",
    ]);
    await bulkInsert("pagos_proveedor", supplierPaymentRows, [
      "id", "empresa_id", "cxp_id", "cuenta_financiera_id", "fecha", "monto",
      "referencia", "notas", "usuario_id",
    ]);

    const saleDates = Array.from({ length: 90 }, (_, index) => isoDate(addDays(new Date(Date.UTC(2026, 4, 3)), index)));
    const sessionRows: AnyRow[] = [];
    const sessionByBranchDate = new Map<string, string>();
    const sessionCashTotals = new Map<string, number>();
    for (const date of saleDates) {
      for (const branch of sucursales) {
        const id = randomUUID();
        sessionByBranchDate.set(`${branch.id}:${date}`, id);
        sessionCashTotals.set(id, 0);
        sessionRows.push({
          id, empresa_id: empresaId, caja_id: cashRegisterByBranch.get(branch.id),
          usuario_id: pick(usuarioIds), estado: "cerrada", monto_inicial: 1500,
          monto_final_esperado: 1500, monto_final_real: 1500, diferencia: 0,
          abierta_en: dateAt(date, 7, 30), cerrada_en: dateAt(date, 20, 30),
          notas: "Sesion diaria generada para demostracion",
        });
      }
    }

    const [existingDocType] = await tx<{ id: string }[]>`
      select id from tipos_documento where empresa_id = ${empresaId} and activo = true limit 1
    `;
    const docTypeId = existingDocType?.id ?? randomUUID();
    if (!existingDocType) {
      await tx`
        insert into tipos_documento (id, empresa_id, codigo, nombre, aplica_a, activo)
        values (${docTypeId}, ${empresaId}, 'FAC', 'Factura', 'venta', true)
      `;
    }
    const [existingSequence] = await tx<{ id: string }[]>`
      select id from secuencias_fiscales
      where empresa_id = ${empresaId} and tipo_documento_id = ${docTypeId} and activa = true
      limit 1
    `;
    const sequenceId = existingSequence?.id ?? randomUUID();
    if (!existingSequence) {
      await tx`
        insert into secuencias_fiscales
          (id, empresa_id, sucursal_id, tipo_documento_id, prefijo, siguiente_numero, rango_inicial, rango_final, autorizacion, fecha_limite, activa)
        values
          (${sequenceId}, ${empresaId}, ${sucursales[0].id}, ${docTypeId}, 'DEM-F', 1, 1, 999999, 'DEMO-NICARIS', '2027-12-31', true)
      `;
    }

    const salesRows: AnyRow[] = [];
    const saleDetailRows: AnyRow[] = [];
    const salePaymentRows: AnyRow[] = [];
    const invoiceRows: AnyRow[] = [];
    const receivableRows: AnyRow[] = [];
    const customerPaymentRows: AnyRow[] = [];
    const fiscalDocumentRows: AnyRow[] = [];
    const saleDetailsBySale = new Map<string, AnyRow[]>();
    const dailySales = new Map<string, { date: string; branchId: string; subtotal: number; tax: number; total: number; cost: number; credit: number }>();

    for (let index = 0; index < 500; index += 1) {
      const saleId = randomUUID();
      const date = saleDates[index % saleDates.length];
      const branch = sucursales[(index + Math.floor(index / 9)) % sucursales.length];
      const warehouseId = warehouseByBranch.get(branch.id)!;
      const sessionId = sessionByBranchDate.get(`${branch.id}:${date}`)!;
      const credit = index % 5 === 0;
      const customer = credit || index % 3 !== 0 ? customerRows[index % customerRows.length] : null;
      const details: AnyRow[] = [];
      const used = new Set<string>();
      const itemCount = 2 + (index % 4);
      while (details.length < itemCount) {
        const product = pick(saleProducts);
        if (used.has(String(product.id))) continue;
        used.add(String(product.id));
        const quantity = 1 + (index + details.length) % 4;
        const unitPrice = Number(product.precio_base);
        const gross = round(quantity * unitPrice);
        const discount = index % 11 === 0 ? round(gross * 0.05) : 0;
        const base = round(gross - discount);
        const itemTax = round(base * impuestoTasa);
        details.push({
          id: randomUUID(), venta_id: saleId, producto_id: product.id,
          lote_id: lotByProduct.get(String(product.id)) ?? null,
          cantidad: quantity, precio_unitario: unitPrice, descuento: discount,
          impuesto: itemTax, costo_unitario: product.costo_promedio, subtotal: base,
        });
        changeStock(String(product.id), warehouseId, -quantity);
        inventoryMovementRows.push({
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id,
          almacen_id: warehouseId, lote_id: lotByProduct.get(String(product.id)) ?? null,
          tipo: "salida_venta", cantidad: -quantity, costo_unitario: product.costo_promedio,
          referencia_tabla: "ventas", referencia_id: saleId,
          notas: "Salida por venta de demostracion", usuario_id: pick(usuarioIds),
          creado_en: dateAt(date, 8 + (index % 12), (index * 7) % 60),
        });
      }
      const subtotal = round(details.reduce((sum, item) => sum + Number(item.subtotal), 0));
      const discount = round(details.reduce((sum, item) => sum + Number(item.descuento), 0));
      const tax = round(details.reduce((sum, item) => sum + Number(item.impuesto), 0));
      const total = round(subtotal + tax);
      const cost = round(details.reduce((sum, item) => sum + Number(item.costo_unitario) * Number(item.cantidad), 0));
      const paymentCode = credit ? "CRE" : index % 4 === 0 ? "TAR" : index % 7 === 0 ? "TRA" : "EFE";
      const paymentForm = paymentByCode.get(paymentCode)!;
      const seller = usuarios[index % usuarios.length];
      const saleTimestamp = dateAt(date, 8 + (index % 12), (index * 7) % 60);

      let fiscalDocumentId: string | null = null;
      if (index < 180) {
        fiscalDocumentId = randomUUID();
        fiscalDocumentRows.push({
          id: fiscalDocumentId, empresa_id: empresaId, secuencia_id: sequenceId,
          tipo_documento_id: docTypeId, numero: `DEM-FISC-${String(index + 1).padStart(6, "0")}`,
          referencia_tabla: "ventas", referencia_id: saleId, fecha: saleTimestamp,
          estado: "emitido", autorizacion: "DEMO-NICARIS",
          metadata: JSON.stringify({ sucursal: branch.nombre, origen: "carga_masiva" }),
        });
      }

      salesRows.push({
        id: saleId, empresa_id: empresaId, sucursal_id: branch.id, sesion_caja_id: sessionId,
        cliente_id: customer?.id ?? null, numero: `DEM-V-${String(index + 1).padStart(6, "0")}`,
        fecha: saleTimestamp, estado: "completada", es_credito: credit,
        dias_credito: credit ? 30 : 0,
        fecha_vencimiento: credit ? isoDate(addDays(new Date(`${date}T12:00:00Z`), 30)) : null,
        subtotal, descuento: discount, impuesto: tax, total, costo_total: cost,
        notas: "Venta historica de demostracion", usuario_id: seller.id,
        documento_fiscal_id: fiscalDocumentId,
      });
      saleDetailRows.push(...details);
      saleDetailsBySale.set(saleId, details);

      if (!credit) {
        salePaymentRows.push({
          id: randomUUID(), venta_id: saleId, forma_pago_id: paymentForm.id,
          monto: total, referencia: paymentCode === "EFE" ? null : `DEM-${paymentCode}-${index + 1}`,
          cambio: 0,
        });
        if (paymentCode === "EFE") {
          sessionCashTotals.set(sessionId, round((sessionCashTotals.get(sessionId) ?? 0) + total));
        }
      }

      const snapshotPayments = credit
        ? []
        : [{ formaPago: paymentForm.nombre, monto: total, referencia: paymentCode === "EFE" ? null : `DEM-${paymentCode}-${index + 1}` }];
      invoiceRows.push({
        id: randomUUID(), empresa_id: empresaId, venta_id: saleId,
        numero: `DEM-F-${String(index + 1).padStart(6, "0")}`, fecha: saleTimestamp,
        vendedor_id: seller.id, vendedor_nombre: seller.nombre,
        cliente_nombre: customer?.nombre ?? "Consumidor final",
        formas_pago: credit ? "Credito" : paymentForm.nombre,
        es_credito: credit, total,
        snapshot: JSON.stringify({
          numero: `DEM-F-${String(index + 1).padStart(6, "0")}`,
          fecha: saleTimestamp.toISOString(), cajero: seller.nombre,
          cliente: customer?.nombre ?? "Consumidor final", esCredito: credit,
          items: details.map((detail) => {
            const product = productById.get(String(detail.producto_id))!;
            return {
              nombre: product.nombre, sku: product.sku, cantidad: Number(detail.cantidad),
              precioUnitario: Number(detail.precio_unitario), subtotal: Number(detail.subtotal),
            };
          }),
          pagos: snapshotPayments, subtotal, descuento: discount, impuesto: tax, total,
        }),
      });

      if (credit && customer) {
        const receivableId = randomUUID();
        const mode = index % 4;
        const paid = mode === 0 ? total : mode === 1 ? round(total * 0.4) : 0;
        const balance = round(total - paid);
        receivableRows.push({
          id: receivableId, empresa_id: empresaId, cliente_id: customer.id,
          venta_id: saleId, fecha_emision: date,
          fecha_vencimiento: isoDate(addDays(new Date(`${date}T12:00:00Z`), 30)),
          monto: total, saldo: balance,
          estado: balance === 0 ? "pagada" : paid > 0 ? "parcial" : index < 180 ? "vencida" : "pendiente",
          notas: "Credito comercial de demostracion",
        });
        if (paid > 0) {
          customerPaymentRows.push({
            id: randomUUID(), empresa_id: empresaId, cxc_id: receivableId,
            forma_pago_id: paymentByCode.get(index % 2 === 0 ? "EFE" : "TRA")!.id,
            fecha: isoDate(addDays(new Date(`${date}T12:00:00Z`), 10)), monto: paid,
            referencia: `DEM-ABO-${String(index + 1).padStart(5, "0")}`,
            notas: "Abono de cliente de demostracion", usuario_id: pick(usuarioIds),
          });
        }
      }

      const dailyKey = `${branch.id}:${date}`;
      const daily = dailySales.get(dailyKey) ?? {
        date, branchId: branch.id, subtotal: 0, tax: 0, total: 0, cost: 0, credit: 0,
      };
      daily.subtotal = round(daily.subtotal + subtotal);
      daily.tax = round(daily.tax + tax);
      daily.total = round(daily.total + total);
      daily.cost = round(daily.cost + cost);
      daily.credit = round(daily.credit + (credit ? total : 0));
      dailySales.set(dailyKey, daily);
    }

    for (const session of sessionRows) {
      const cash = sessionCashTotals.get(String(session.id)) ?? 0;
      const difference = int(-2, 2) * 5;
      session.monto_final_esperado = round(1500 + cash);
      session.monto_final_real = round(1500 + cash + difference);
      session.diferencia = difference;
    }

    await bulkInsert("sesiones_caja", sessionRows, [
      "id", "empresa_id", "caja_id", "usuario_id", "estado", "monto_inicial",
      "monto_final_esperado", "monto_final_real", "diferencia", "abierta_en", "cerrada_en", "notas",
    ]);
    await bulkInsert("documentos_fiscales", fiscalDocumentRows, [
      "id", "empresa_id", "secuencia_id", "tipo_documento_id", "numero", "referencia_tabla",
      "referencia_id", "fecha", "estado", "autorizacion", "metadata",
    ]);
    await bulkInsert("ventas", salesRows, [
      "id", "empresa_id", "sucursal_id", "sesion_caja_id", "cliente_id", "numero", "fecha",
      "estado", "es_credito", "dias_credito", "fecha_vencimiento", "subtotal", "descuento",
      "impuesto", "total", "costo_total", "notas", "usuario_id", "documento_fiscal_id",
    ]);
    await bulkInsert("venta_detalle", saleDetailRows, [
      "id", "venta_id", "producto_id", "lote_id", "cantidad", "precio_unitario", "descuento",
      "impuesto", "costo_unitario", "subtotal",
    ]);
    await bulkInsert("pagos_venta", salePaymentRows, [
      "id", "venta_id", "forma_pago_id", "monto", "referencia", "cambio",
    ]);
    await bulkInsert("facturas", invoiceRows, [
      "id", "empresa_id", "venta_id", "numero", "fecha", "vendedor_id", "vendedor_nombre",
      "cliente_nombre", "formas_pago", "es_credito", "total", "snapshot",
    ]);
    await bulkInsert("cuentas_por_cobrar", receivableRows, [
      "id", "empresa_id", "cliente_id", "venta_id", "fecha_emision", "fecha_vencimiento",
      "monto", "saldo", "estado", "notas",
    ]);
    await bulkInsert("abonos_cliente", customerPaymentRows, [
      "id", "empresa_id", "cxc_id", "forma_pago_id", "fecha", "monto", "referencia", "notas", "usuario_id",
    ]);
    await tx`
      update secuencias_fiscales set siguiente_numero = siguiente_numero + ${fiscalDocumentRows.length}
      where id = ${sequenceId}
    `;

    const creditNoteRows: AnyRow[] = [];
    const creditNoteDetailRows: AnyRow[] = [];
    for (let index = 0; index < 12; index += 1) {
      const sale = salesRows[index * 7 + 3];
      const detail = saleDetailsBySale.get(String(sale.id))![0];
      const noteId = randomUUID();
      const saleDate = isoDate(sale.fecha as Date);
      const base = Number(detail.precio_unitario);
      const tax = round(base * impuestoTasa);
      creditNoteRows.push({
        id: noteId, empresa_id: empresaId, venta_id: sale.id,
        numero: `DEM-NC-${String(index + 1).padStart(4, "0")}`,
        fecha: saleDate, motivo: index % 2 === 0 ? "Producto devuelto" : "Cambio solicitado por cliente",
        subtotal: base, impuesto: tax, total: round(base + tax), usuario_id: pick(usuarioIds),
      });
      creditNoteDetailRows.push({
        id: randomUUID(), nota_id: noteId, producto_id: detail.producto_id,
        cantidad: 1, precio_unitario: detail.precio_unitario, subtotal: base,
      });
      const branchId = String(sale.sucursal_id);
      const warehouseId = warehouseByBranch.get(branchId)!;
      changeStock(String(detail.producto_id), warehouseId, 1);
      inventoryMovementRows.push({
        id: randomUUID(), empresa_id: empresaId, producto_id: detail.producto_id,
        almacen_id: warehouseId, lote_id: detail.lote_id,
        tipo: "devolucion_cliente", cantidad: 1, costo_unitario: detail.costo_unitario,
        referencia_tabla: "notas_credito", referencia_id: noteId,
        notas: "Devolucion de demostracion", usuario_id: pick(usuarioIds),
        creado_en: dateAt(saleDate, 16),
      });
    }
    await bulkInsert("notas_credito", creditNoteRows, [
      "id", "empresa_id", "venta_id", "numero", "fecha", "motivo", "subtotal", "impuesto", "total", "usuario_id",
    ]);
    await bulkInsert("nota_credito_detalle", creditNoteDetailRows, [
      "id", "nota_id", "producto_id", "cantidad", "precio_unitario", "subtotal",
    ]);

    for (let index = 0; index < 24; index += 1) {
      const product = simpleProducts[index % simpleProducts.length];
      const source = sucursales[index % 2];
      const target = sucursales[(index + 1) % 2];
      const sourceWarehouse = warehouseByBranch.get(source.id)!;
      const targetWarehouse = warehouseByBranch.get(target.id)!;
      const quantity = 4 + (index % 8);
      const transferId = randomUUID();
      changeStock(String(product.id), sourceWarehouse, -quantity);
      changeStock(String(product.id), targetWarehouse, quantity);
      inventoryMovementRows.push(
        {
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id, almacen_id: sourceWarehouse,
          lote_id: lotByProduct.get(String(product.id)) ?? null, tipo: "transferencia_salida",
          cantidad: -quantity, costo_unitario: product.costo_promedio,
          referencia_tabla: "transferencias_demo", referencia_id: transferId,
          notas: `Traslado hacia ${target.nombre}`, usuario_id: pick(usuarioIds),
          creado_en: dateAt(saleDates[20 + (index % 60)], 11),
        },
        {
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id, almacen_id: targetWarehouse,
          lote_id: lotByProduct.get(String(product.id)) ?? null, tipo: "transferencia_entrada",
          cantidad: quantity, costo_unitario: product.costo_promedio,
          referencia_tabla: "transferencias_demo", referencia_id: transferId,
          notas: `Traslado desde ${source.nombre}`, usuario_id: pick(usuarioIds),
          creado_en: dateAt(saleDates[20 + (index % 60)], 12),
        },
      );
    }

    const existenceRows: AnyRow[] = [];
    for (const product of simpleProducts) {
      for (const branch of sucursales) {
        const warehouseId = warehouseByBranch.get(branch.id)!;
        existenceRows.push({
          id: randomUUID(), empresa_id: empresaId, producto_id: product.id,
          almacen_id: warehouseId, lote_id: lotByProduct.get(String(product.id)) ?? null,
          cantidad: stockByProductWarehouse.get(stockKey(String(product.id), warehouseId)) ?? 0,
          cantidad_reservada: int(0, 4),
        });
      }
    }
    await bulkInsert("existencias", existenceRows, [
      "id", "empresa_id", "producto_id", "almacen_id", "lote_id", "cantidad", "cantidad_reservada",
    ]);
    await bulkInsert("movimientos_inventario", inventoryMovementRows, [
      "id", "empresa_id", "producto_id", "almacen_id", "lote_id", "tipo", "cantidad",
      "costo_unitario", "referencia_tabla", "referencia_id", "notas", "usuario_id", "creado_en",
    ]);

    const inventoryCountRows: AnyRow[] = [];
    const inventoryCountDetailRows: AnyRow[] = [];
    for (let index = 0; index < 4; index += 1) {
      const countId = randomUUID();
      const branch = sucursales[index % 2];
      const warehouseId = warehouseByBranch.get(branch.id)!;
      inventoryCountRows.push({
        id: countId, empresa_id: empresaId, almacen_id: warehouseId,
        fecha: saleDates[30 + index * 15], estado: "aplicado",
        notas: "Conteo ciclico de demostracion", usuario_id: pick(usuarioIds),
        aplicado_en: dateAt(saleDates[30 + index * 15], 18),
      });
      for (const product of simpleProducts.slice(index * 12, index * 12 + 18)) {
        const expected = stockByProductWarehouse.get(stockKey(String(product.id), warehouseId)) ?? 0;
        const difference = (int(-1, 1));
        inventoryCountDetailRows.push({
          id: randomUUID(), conteo_id: countId, producto_id: product.id,
          cantidad_esperada: expected, cantidad_fisica: expected + difference, diferencia: difference,
        });
      }
    }
    await bulkInsert("conteos_inventario", inventoryCountRows, [
      "id", "empresa_id", "almacen_id", "fecha", "estado", "notas", "usuario_id", "aplicado_en",
    ]);
    await bulkInsert("conteo_detalle", inventoryCountDetailRows, [
      "id", "conteo_id", "producto_id", "cantidad_esperada", "cantidad_fisica", "diferencia",
    ]);

    const quoteRows: AnyRow[] = [];
    const quoteDetailRows: AnyRow[] = [];
    const quoteStates = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];
    for (let index = 0; index < 45; index += 1) {
      const quoteId = randomUUID();
      const date = saleDates[20 + (index % 60)];
      const details: AnyRow[] = [];
      for (let itemIndex = 0; itemIndex < 3; itemIndex += 1) {
        const product = simpleProducts[(index * 5 + itemIndex * 7) % simpleProducts.length];
        const quantity = 2 + itemIndex;
        const base = round(quantity * Number(product.precio_base));
        details.push({
          id: randomUUID(), cotizacion_id: quoteId, producto_id: product.id,
          cantidad: quantity, precio_unitario: product.precio_base, descuento: 0,
          impuesto: round(base * impuestoTasa), subtotal: base,
        });
      }
      const subtotal = round(details.reduce((sum, item) => sum + Number(item.subtotal), 0));
      const tax = round(details.reduce((sum, item) => sum + Number(item.impuesto), 0));
      quoteRows.push({
        id: quoteId, empresa_id: empresaId, sucursal_id: sucursales[index % 2].id,
        cliente_id: customerRows[index % customerRows.length].id,
        numero: `DEM-COT-${String(index + 1).padStart(4, "0")}`, fecha: date,
        vigente_hasta: isoDate(addDays(new Date(`${date}T12:00:00Z`), 15)),
        estado: quoteStates[index % quoteStates.length], subtotal, descuento: 0,
        impuesto: tax, total: round(subtotal + tax), venta_id: null,
        notas: "Cotizacion comercial de demostracion", usuario_id: pick(usuarioIds),
      });
      quoteDetailRows.push(...details);
    }
    await bulkInsert("cotizaciones", quoteRows, [
      "id", "empresa_id", "sucursal_id", "cliente_id", "numero", "fecha", "vigente_hasta",
      "estado", "subtotal", "descuento", "impuesto", "total", "venta_id", "notas", "usuario_id",
    ]);
    await bulkInsert("cotizacion_detalle", quoteDetailRows, [
      "id", "cotizacion_id", "producto_id", "cantidad", "precio_unitario", "descuento", "impuesto", "subtotal",
    ]);

    const employeeFirstNames = [
      "Adriana", "Alejandro", "Beatriz", "Cristian", "Diana", "Eduardo", "Fatima", "Gerardo",
      "Heydi", "Ivan", "Julia", "Kevin", "Lorena", "Mario", "Natalia", "Omar", "Patricia",
      "Ramon", "Silvia", "Tomas", "Vanessa", "Walter", "Xiomara", "Yader", "Zayda", "Noel",
      "Karla", "Ernesto", "Martha",
    ];
    const employeeLastNames = [
      "Aguirre", "Blandon", "Cruz", "Duarte", "Flores", "Gutierrez", "Herrera", "Jimenez",
      "Lacayo", "Mairena", "Obando", "Pineda", "Quezada", "Reyes", "Solorzano",
    ];
    const positions = [
      ["Cajero", "Ventas", 14500], ["Vendedor", "Ventas", 16000],
      ["Auxiliar de bodega", "Inventario", 15500], ["Supervisor de tienda", "Operaciones", 24000],
      ["Contador auxiliar", "Administracion", 22500], ["Comprador", "Compras", 21000],
      ["Repartidor", "Logistica", 15000], ["Encargado de limpieza", "Servicios", 13500],
    ] as const;
    const employeeRows = employeeFirstNames.map((firstName, index) => {
      const [position, department, baseSalary] = positions[index % positions.length];
      return {
        id: randomUUID(), empresa_id: empresaId, sucursal_id: sucursales[index % 2].id,
        usuario_id: null, codigo: `DEM-E${String(index + 1).padStart(3, "0")}`,
        nombres: firstName, apellidos: `${employeeLastNames[index % employeeLastNames.length]} ${employeeLastNames[(index + 5) % employeeLastNames.length]}`,
        identificacion: `DEMO-CED-${String(index + 1).padStart(4, "0")}`,
        email: `empleado${index + 1}@example.test`, telefono: `0000-${String(4000 + index).padStart(4, "0")}`,
        direccion: `${pick(["Managua", "Bello Horizonte", "Ciudad Sandino", "Tipitapa"])} - direccion demo`,
        ciudad: "Managua", municipio: index % 4 === 0 ? "Ciudad Sandino" : "Managua",
        estado_civil: index % 3 === 0 ? "casado" : "soltero", nacionalidad: "Nicaraguense",
        profesion_oficio: position, dependientes: index % 4,
        fecha_nacimiento: `${1982 + (index % 18)}-${String((index % 12) + 1).padStart(2, "0")}-15`,
        genero: index % 2 === 0 ? "F" : "M", puesto: position, departamento: department,
        tipo_contrato: index % 11 === 0 ? "temporal" : "indefinido",
        fecha_ingreso: `${2021 + (index % 5)}-${String((index % 12) + 1).padStart(2, "0")}-01`,
        salario_base: baseSalary + (index % 5) * 750, frecuencia_pago: "mensual",
        dias_vacaciones_anuales: 15, banco: index % 2 === 0 ? "Banco Demo Nicaragua" : "Banco Nacional Demo",
        cuenta_banco: `DEM-NOM-${String(index + 1).padStart(6, "0")}`,
        contacto_emergencia_nombre: `Contacto familiar ${index + 1}`,
        contacto_emergencia_telefono: `0000-${String(5000 + index).padStart(4, "0")}`,
        estado: index === 27 ? "vacaciones" : "activo",
        notas: "Expediente generado para demostracion Nicaris",
      };
    });
    await bulkInsert("empleados", employeeRows, [
      "id", "empresa_id", "sucursal_id", "usuario_id", "codigo", "nombres", "apellidos",
      "identificacion", "email", "telefono", "direccion", "ciudad", "municipio", "estado_civil",
      "nacionalidad", "profesion_oficio", "dependientes", "fecha_nacimiento", "genero", "puesto",
      "departamento", "tipo_contrato", "fecha_ingreso", "salario_base", "frecuencia_pago",
      "dias_vacaciones_anuales", "banco", "cuenta_banco", "contacto_emergencia_nombre",
      "contacto_emergencia_telefono", "estado", "notas",
    ]);

    const employees = await tx<{
      id: string; codigo: string; nombres: string; apellidos: string; salario_base: string;
      departamento: string | null; puesto: string; sucursal_id: string | null;
    }[]>`
      select id, codigo, nombres, apellidos, salario_base, departamento, puesto, sucursal_id
      from empleados
      where empresa_id = ${empresaId} and eliminado_en is null and estado <> 'baja'
      order by codigo
    `;

    const attendanceRows: AnyRow[] = [];
    const attendanceStart = new Date(Date.UTC(2026, 4, 18));
    for (let dayIndex = 0; dayIndex < 55; dayIndex += 1) {
      const dateObject = addDays(attendanceStart, dayIndex);
      const day = dateObject.getUTCDay();
      if (day === 0 || day === 6) continue;
      const date = isoDate(dateObject);
      employees.forEach((employee, employeeIndex) => {
        const roll = (employeeIndex * 13 + dayIndex * 7) % 100;
        const state = roll < 82 ? "presente" : roll < 90 ? "tarde" : roll < 94 ? "permiso" : roll < 97 ? "justificado" : "ausente";
        const works = state === "presente" || state === "tarde";
        const entryHour = state === "tarde" ? 8 : 7;
        const extra = works && (employeeIndex + dayIndex) % 9 === 0 ? 1 + ((employeeIndex + dayIndex) % 3) * 0.5 : 0;
        attendanceRows.push({
          id: randomUUID(), empresa_id: empresaId, empleado_id: employee.id, fecha: date,
          estado: state, hora_entrada: works ? dateAt(date, entryHour, state === "tarde" ? 25 : 55) : null,
          hora_salida: works ? dateAt(date, 17 + Math.floor(extra), extra % 1 === 0.5 ? 30 : 0) : null,
          horas_trabajadas: works ? 8 : 0, horas_extra: extra,
          notas: state === "tarde" ? "Llegada tardia registrada" : state === "ausente" ? "Ausencia de demostracion" : null,
          registrado_por: pick(usuarioIds),
        });
      });
    }
    if (attendanceRows.length > 0) {
      await tx`insert into asistencias ${tx(attendanceRows,
        "id", "empresa_id", "empleado_id", "fecha", "estado", "hora_entrada", "hora_salida",
        "horas_trabajadas", "horas_extra", "notas", "registrado_por"
      )} on conflict (empleado_id, fecha) do nothing`;
    }

    const holidayRows = [
      { id: randomUUID(), empresa_id: empresaId, nombre: "Fiesta local Bello Horizonte", fecha: "2026-08-15", es_nacional: false, es_recurrente: true },
      { id: randomUUID(), empresa_id: empresaId, nombre: "Aniversario Nicaris", fecha: "2026-10-10", es_nacional: false, es_recurrente: true },
    ];
    await tx`insert into feriados ${tx(holidayRows,
      "id", "empresa_id", "nombre", "fecha", "es_nacional", "es_recurrente"
    )} on conflict (empresa_id, fecha, nombre) do nothing`;

    const incomeTypeNames = ["Bono de productividad", "Comision especial", "Viatico", "Incentivo por meta"];
    for (const nombre of incomeTypeNames) {
      await tx`
        insert into tipos_ingreso (id, empresa_id, nombre, activo)
        values (${randomUUID()}, ${empresaId}, ${nombre}, true)
        on conflict (empresa_id, nombre) do nothing
      `;
    }
    const deductionTypeNames = ["Prestamo interno", "Uniforme", "Alimentacion", "Compra de empleado"];
    for (const nombre of deductionTypeNames) {
      await tx`
        insert into tipos_deduccion (id, empresa_id, nombre, activo)
        values (${randomUUID()}, ${empresaId}, ${nombre}, true)
        on conflict (empresa_id, nombre) do nothing
      `;
    }
    const incomeTypes = await tx<{ id: string; nombre: string }[]>`
      select id, nombre from tipos_ingreso where empresa_id = ${empresaId} and nombre = any(${incomeTypeNames})
    `;
    const deductionTypes = await tx<{ id: string; nombre: string }[]>`
      select id, nombre from tipos_deduccion where empresa_id = ${empresaId} and nombre = any(${deductionTypeNames})
    `;
    if (incomeTypes.length !== incomeTypeNames.length || deductionTypes.length !== deductionTypeNames.length) {
      throw new Error("No se pudieron preparar todos los tipos de ingresos y deducciones de nomina.");
    }

    const payrollRows: AnyRow[] = [];
    const payrollDetailRows: AnyRow[] = [];
    const payrollIncomeRows: AnyRow[] = [];
    const payrollDeductionRows: AnyRow[] = [];
    const payslipRows: AnyRow[] = [];
    const payrollAccounting: { id: string; date: string; devengado: number; deducciones: number; neto: number }[] = [];

    for (let month = 2; month <= 7; month += 1) {
      const payrollId = randomUUID();
      const periodStart = `${2026}-${String(month).padStart(2, "0")}-01`;
      const periodEnd = isoDate(new Date(Date.UTC(2026, month, 0)));
      const payDate = periodEnd;
      let totalDevengado = 0;
      let totalDeducciones = 0;
      let totalNeto = 0;

      for (let employeeIndex = 0; employeeIndex < employees.length; employeeIndex += 1) {
        const employee = employees[employeeIndex];
        const detailId = randomUUID();
        const salary = Number(employee.salario_base);
        const extraHours = (employeeIndex + month) % 5 === 0 ? 4 + (employeeIndex % 4) : 0;
        const extraAmount = round((salary / 240) * 1.5 * extraHours);
        const bonus = (employeeIndex + month) % 4 === 0 ? 800 + (employeeIndex % 5) * 150 : 0;
        const commission = employee.departamento === "Ventas" ? 500 + (employeeIndex % 6) * 125 : 0;
        const devengado = round(salary + extraAmount + bonus + commission);
        const socialSecurity = round(devengado * 0.07);
        const incomeTax = salary >= 25000 ? round(devengado * 0.05) : salary >= 19000 ? round(devengado * 0.02) : 0;
        const otherDeduction = (employeeIndex + month) % 6 === 0 ? 350 + (employeeIndex % 4) * 100 : 0;
        const deductions = round(socialSecurity + incomeTax + otherDeduction);
        const net = round(devengado - deductions);
        totalDevengado = round(totalDevengado + devengado);
        totalDeducciones = round(totalDeducciones + deductions);
        totalNeto = round(totalNeto + net);

        payrollDetailRows.push({
          id: detailId, empresa_id: empresaId, nomina_id: payrollId, empleado_id: employee.id,
          salario_base: salary, dias_trabajados: 30, horas_extra: extraHours,
          monto_horas_extra: extraAmount, bonificaciones: bonus, comisiones: commission,
          total_devengado: devengado, deduccion_seguridad_social: socialSecurity,
          deduccion_renta: incomeTax, otras_deducciones: otherDeduction,
          total_deducciones: deductions, total_neto: net,
          estado_pago: "pagado", pagado_en: dateAt(payDate, 14),
          notas: "Detalle mensual de demostracion",
        });

        if (bonus > 0) {
          payrollIncomeRows.push({
            id: randomUUID(), empresa_id: empresaId, nomina_detalle_id: detailId,
            tipo_ingreso_id: incomeTypes[(employeeIndex + month) % incomeTypes.length].id,
            monto: bonus, semana: "semana_2", nota: "Ingreso extra por cumplimiento de meta",
          });
        }
        if (otherDeduction > 0) {
          payrollDeductionRows.push({
            id: randomUUID(), empresa_id: empresaId, nomina_detalle_id: detailId,
            tipo_deduccion_id: deductionTypes[(employeeIndex + month) % deductionTypes.length].id,
            monto: otherDeduction, semana: "semana_2", nota: "Deduccion autorizada para demostracion",
          });
        }

        const weekOneEnd = `${2026}-${String(month).padStart(2, "0")}-15`;
        const weekTwoStart = `${2026}-${String(month).padStart(2, "0")}-16`;
        const halfSalary = round(salary / 2);
        const halfSocial = round(socialSecurity / 2);
        const halfTax = round(incomeTax / 2);
        const weekOneIncome = halfSalary;
        const weekTwoIncome = round(salary - halfSalary + extraAmount + bonus + commission);
        const weekOneDeduction = round(halfSocial + halfTax);
        const weekTwoDeduction = round(socialSecurity - halfSocial + incomeTax - halfTax + otherDeduction);
        const snapshot = {
          empresa: {
            nombre: empresa.nombre_comercial ?? empresa.razon_social,
            identificacionFiscal: "Nicaris S.A", direccion: "Managua, Nicaragua", telefono: null, pais: "NI",
          },
          periodo: {
            nomina: `DEM-NOM-2026-${String(month).padStart(2, "0")}`,
            descripcion: `Nomina mensual ${String(month).padStart(2, "0")}/2026`, frecuencia: "mensual",
            inicio: periodStart, fin: periodEnd, fechaPago: payDate,
          },
          empleado: {
            id: employee.id, codigo: employee.codigo,
            nombre: `${employee.nombres} ${employee.apellidos}`, salarioMensual: salary,
            departamento: employee.departamento, equipo: employee.puesto, puesto: employee.puesto,
          },
          semanas: [
            {
              clave: "semana_1", label: "Semana 1", inicio: periodStart, fin: weekOneEnd,
              ingresos: [{ concepto: "Salario", monto: halfSalary, nota: "Primera mitad del periodo" }],
              deducciones: [
                { concepto: "INSS laboral", monto: halfSocial, nota: "Deduccion fija" },
                ...(halfTax > 0 ? [{ concepto: "IR", monto: halfTax, nota: "Deduccion fija" }] : []),
              ],
              totalIngresos: weekOneIncome, totalDeducciones: weekOneDeduction,
              neto: round(weekOneIncome - weekOneDeduction),
            },
            {
              clave: "semana_2", label: "Semana 2", inicio: weekTwoStart, fin: periodEnd,
              ingresos: [
                { concepto: "Salario", monto: round(salary - halfSalary), nota: "Segunda mitad del periodo" },
                ...(extraAmount > 0 ? [{ concepto: "Horas extra", monto: extraAmount, nota: `${extraHours} horas` }] : []),
                ...(bonus > 0 ? [{ concepto: "Bono de productividad", monto: bonus, nota: "Meta alcanzada" }] : []),
                ...(commission > 0 ? [{ concepto: "Comision", monto: commission, nota: "Comision mensual" }] : []),
              ],
              deducciones: [
                { concepto: "INSS laboral", monto: round(socialSecurity - halfSocial), nota: "Deduccion fija" },
                ...(incomeTax - halfTax > 0 ? [{ concepto: "IR", monto: round(incomeTax - halfTax), nota: "Deduccion fija" }] : []),
                ...(otherDeduction > 0 ? [{ concepto: "Otras deducciones", monto: otherDeduction, nota: "Deduccion autorizada" }] : []),
              ],
              totalIngresos: weekTwoIncome, totalDeducciones: weekTwoDeduction,
              neto: round(weekTwoIncome - weekTwoDeduction),
            },
          ],
          totales: { totalIngresos: devengado, totalDeducciones: deductions, pagoNeto: net },
          generadoEn: dateAt(payDate, 14).toISOString(),
        };
        payslipRows.push({
          id: randomUUID(), empresa_id: empresaId, nomina_id: payrollId,
          nomina_detalle_id: detailId, empleado_id: employee.id,
          numero: `COL-DEM-${String(month).padStart(2, "0")}-${employee.codigo}`,
          snapshot: JSON.stringify(snapshot), generado_en: dateAt(payDate, 14), actualizado_en: dateAt(payDate, 14),
        });
      }

      payrollRows.push({
        id: payrollId, empresa_id: empresaId,
        numero: `DEM-NOM-2026-${String(month).padStart(2, "0")}`,
        descripcion: `Nomina mensual ${String(month).padStart(2, "0")}/2026`, frecuencia: "mensual",
        periodo_inicio: periodStart, periodo_fin: periodEnd, fecha_pago: payDate,
        estado: "pagada", nivel_verificacion: 3, empleados_count: employees.length,
        total_devengado: totalDevengado, total_deducciones: totalDeducciones, total_neto: totalNeto,
        cuenta_financiera_id: financialRows[0].id, notas: "Nomina historica de demostracion",
        creado_por: usuarioIds[0], aprobado_por: usuarioIds[0],
        aprobado_en: dateAt(payDate, 10), pagado_en: dateAt(payDate, 14),
      });
      payrollAccounting.push({ id: payrollId, date: payDate, devengado: totalDevengado, deducciones: totalDeducciones, neto: totalNeto });
    }
    await bulkInsert("nominas", payrollRows, [
      "id", "empresa_id", "numero", "descripcion", "frecuencia", "periodo_inicio", "periodo_fin",
      "fecha_pago", "estado", "nivel_verificacion", "empleados_count", "total_devengado",
      "total_deducciones", "total_neto", "cuenta_financiera_id", "notas", "creado_por",
      "aprobado_por", "aprobado_en", "pagado_en",
    ]);
    await bulkInsert("nomina_detalles", payrollDetailRows, [
      "id", "empresa_id", "nomina_id", "empleado_id", "salario_base", "dias_trabajados",
      "horas_extra", "monto_horas_extra", "bonificaciones", "comisiones", "total_devengado",
      "deduccion_seguridad_social", "deduccion_renta", "otras_deducciones", "total_deducciones",
      "total_neto", "estado_pago", "pagado_en", "notas",
    ]);
    await bulkInsert("nomina_ingresos", payrollIncomeRows, [
      "id", "empresa_id", "nomina_detalle_id", "tipo_ingreso_id", "monto", "semana", "nota",
    ]);
    await bulkInsert("nomina_deducciones", payrollDeductionRows, [
      "id", "empresa_id", "nomina_detalle_id", "tipo_deduccion_id", "monto", "semana", "nota",
    ]);
    await bulkInsert("nomina_colillas", payslipRows, [
      "id", "empresa_id", "nomina_id", "nomina_detalle_id", "empleado_id", "numero",
      "snapshot", "generado_en", "actualizado_en",
    ]);

    const requestRows = Array.from({ length: 36 }, (_, index) => {
      const employee = employees[index % employees.length];
      const type = ["vacaciones", "permiso", "incapacidad", "adelanto", "constancia", "otro"][index % 6];
      const state = ["pendiente", "aprobada", "aprobada", "rechazada"][index % 4];
      const start = saleDates[40 + (index % 45)];
      return {
        id: randomUUID(), empresa_id: empresaId, empleado_id: employee.id,
        tipo: type, estado: state, fecha_inicio: start,
        fecha_fin: type === "vacaciones" || type === "incapacidad" ? isoDate(addDays(new Date(`${start}T12:00:00Z`), 2 + (index % 4))) : start,
        dias: type === "vacaciones" || type === "incapacidad" ? 3 + (index % 4) : 1,
        monto: type === "adelanto" ? 1500 + index * 50 : null,
        motivo: `Solicitud de demostracion: ${type}`,
        comentario_resolucion: state === "pendiente" ? null : state === "aprobada" ? "Aprobada segun politica interna" : "No procede en las fechas indicadas",
        resuelto_por: state === "pendiente" ? null : usuarioIds[0],
        resuelto_en: state === "pendiente" ? null : dateAt(start, 15),
      };
    });
    await bulkInsert("solicitudes_rrhh", requestRows, [
      "id", "empresa_id", "empleado_id", "tipo", "estado", "fecha_inicio", "fecha_fin", "dias",
      "monto", "motivo", "comentario_resolucion", "resuelto_por", "resuelto_en",
    ]);

    const expenseCategories = await tx<{ id: string; nombre: string; cuenta_contable_id: string | null }[]>`
      select id, nombre, cuenta_contable_id from categorias_gasto
      where empresa_id = ${empresaId} and activa = true
    `;
    if (expenseCategories.length === 0) throw new Error("Nicaris no tiene categorias de gasto activas.");
    const expenseDescriptions = [
      "Pago de energia electrica", "Servicio de agua potable", "Internet empresarial",
      "Material de limpieza", "Papeleria y utiles", "Mantenimiento preventivo",
      "Publicidad en redes", "Combustible para entregas", "Reparacion de equipo", "Alquiler de local",
    ];
    const expenseRows: AnyRow[] = [];
    for (let index = 0; index < 80; index += 1) {
      const date = saleDates[5 + (index % 80)];
      const subtotal = round(350 + (index % 12) * 185 + random() * 400);
      const tax = index % 3 === 0 ? round(subtotal * impuestoTasa) : 0;
      expenseRows.push({
        id: randomUUID(), empresa_id: empresaId, sucursal_id: sucursales[index % 2].id,
        categoria_id: expenseCategories[index % expenseCategories.length].id,
        proveedor_id: index % 4 === 0 ? supplierRows[index % supplierRows.length].id : null,
        cuenta_financiera_id: financialRows[index % financialRows.length].id,
        fecha: date, descripcion: expenseDescriptions[index % expenseDescriptions.length],
        referencia: `DEM-GAS-${String(index + 1).padStart(5, "0")}`,
        subtotal, impuesto: tax, total: round(subtotal + tax), usuario_id: pick(usuarioIds),
      });
    }
    await bulkInsert("gastos", expenseRows, [
      "id", "empresa_id", "sucursal_id", "categoria_id", "proveedor_id", "cuenta_financiera_id",
      "fecha", "descripcion", "referencia", "subtotal", "impuesto", "total", "usuario_id",
    ]);

    const treasuryRows: AnyRow[] = [];
    Array.from(dailySales.values()).slice(0, 120).forEach((daily, index) => {
      treasuryRows.push({
        id: randomUUID(), empresa_id: empresaId, cuenta_id: financialRows[index % financialRows.length].id,
        cuenta_destino_id: null, tipo: "ingreso", fecha: daily.date,
        monto: round(daily.total - daily.credit), descripcion: `Ingreso diario ${branchById.get(daily.branchId)?.nombre}`,
        referencia: `DEM-ING-${String(index + 1).padStart(5, "0")}`,
        referencia_tabla: "ventas_resumen", referencia_id: null,
        conciliado: index % 4 !== 0, fecha_conciliacion: index % 4 !== 0 ? daily.date : null,
        usuario_id: pick(usuarioIds),
      });
    });
    expenseRows.slice(0, 60).forEach((expense, index) => {
      treasuryRows.push({
        id: randomUUID(), empresa_id: empresaId, cuenta_id: expense.cuenta_financiera_id,
        cuenta_destino_id: null, tipo: "egreso", fecha: expense.fecha, monto: expense.total,
        descripcion: expense.descripcion, referencia: expense.referencia,
        referencia_tabla: "gastos", referencia_id: expense.id,
        conciliado: index % 5 !== 0, fecha_conciliacion: index % 5 !== 0 ? expense.fecha : null,
        usuario_id: pick(usuarioIds),
      });
    });
    for (let index = 0; index < 12; index += 1) {
      treasuryRows.push({
        id: randomUUID(), empresa_id: empresaId, cuenta_id: financialRows[0].id,
        cuenta_destino_id: financialRows[1].id, tipo: "transferencia",
        fecha: saleDates[10 + index * 6], monto: 3000 + index * 250,
        descripcion: "Fondo operativo entre cuentas demo", referencia: `DEM-TRF-${index + 1}`,
        referencia_tabla: "transferencia_demo", referencia_id: null,
        conciliado: true, fecha_conciliacion: saleDates[10 + index * 6], usuario_id: usuarioIds[0],
      });
    }
    await bulkInsert("movimientos_tesoreria", treasuryRows, [
      "id", "empresa_id", "cuenta_id", "cuenta_destino_id", "tipo", "fecha", "monto",
      "descripcion", "referencia", "referencia_tabla", "referencia_id", "conciliado",
      "fecha_conciliacion", "usuario_id",
    ]);

    const exchangeRateRows = Array.from({ length: 26 }, (_, index) => ({
      id: randomUUID(), empresa_id: empresaId, moneda_origen: "USD", moneda_destino: "NIO",
      tasa: round(36.62 + Math.sin(index / 3) * 0.08, 4),
      fecha: isoDate(addDays(new Date(Date.UTC(2026, 1, 2)), index * 7)),
    }));
    await tx`insert into tipos_cambio ${tx(exchangeRateRows,
      "id", "empresa_id", "moneda_origen", "moneda_destino", "tasa", "fecha"
    )} on conflict (empresa_id, moneda_origen, moneda_destino, fecha) do nothing`;

    const accountingRows: AnyRow[] = [];
    const accountingLineRows: AnyRow[] = [];
    let accountingNumber = 0;
    const centerByBranch = new Map(sucursales.map((branch, index) => [branch.id, costCenterRows[index].id]));
    const addAccountingEntry = ({
      date, concept, origin, referenceTable, referenceId, lines,
    }: {
      date: string; concept: string; origin: string; referenceTable: string; referenceId: string | null;
      lines: { account: string; debit?: number; credit?: number; description: string; centerId?: string | null }[];
    }) => {
      const month = Number(date.slice(5, 7));
      const periodId = periodByMonth.get(month);
      if (!periodId) throw new Error(`No existe periodo contable para ${date}.`);
      const entryId = randomUUID();
      accountingNumber += 1;
      const totalDebit = round(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0));
      const totalCredit = round(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0));
      if (Math.abs(totalDebit - totalCredit) > 0.02) {
        throw new Error(`Asiento descuadrado ${concept}: ${totalDebit} / ${totalCredit}`);
      }
      accountingRows.push({
        id: entryId, empresa_id: empresaId, periodo_id: periodId,
        numero: `DEM-AST-${String(accountingNumber).padStart(6, "0")}`,
        fecha: date, concepto: concept, origen: origin,
        referencia_tabla: referenceTable, referencia_id: referenceId,
        total_debe: totalDebit, total_haber: totalCredit, estado: "registrado",
        usuario_id: pick(usuarioIds),
      });
      lines.forEach((line, index) => accountingLineRows.push({
        id: randomUUID(), asiento_id: entryId, cuenta_id: cuentaByCode.get(line.account),
        centro_costo_id: line.centerId ?? null, descripcion: line.description,
        debe: round(line.debit ?? 0), haber: round(line.credit ?? 0), orden: index + 1,
      }));
      return entryId;
    };

    for (const daily of dailySales.values()) {
      const cash = round(daily.total - daily.credit);
      const centerId = centerByBranch.get(daily.branchId);
      const lines = [
        ...(cash > 0 ? [{ account: "1101", debit: cash, description: "Ventas de contado", centerId }] : []),
        ...(daily.credit > 0 ? [{ account: "1104", debit: daily.credit, description: "Ventas a credito", centerId }] : []),
        { account: "5101", debit: daily.cost, description: "Costo de ventas", centerId },
        { account: "4101", credit: daily.subtotal, description: "Ingreso por ventas", centerId },
        { account: "2102", credit: daily.tax, description: "IVA por pagar", centerId },
        { account: "1105", credit: daily.cost, description: "Salida de inventario", centerId },
      ];
      addAccountingEntry({
        date: daily.date, concept: `Ventas diarias - ${branchById.get(daily.branchId)?.nombre}`,
        origin: "venta", referenceTable: "ventas_resumen", referenceId: null, lines,
      });
    }
    for (const purchase of purchaseAccounting) {
      addAccountingEntry({
        date: purchase.fecha, concept: `Compra de mercaderia ${purchase.id.slice(0, 8)}`,
        origin: "compra", referenceTable: "compras", referenceId: purchase.id,
        lines: [
          { account: "1105", debit: purchase.subtotal, description: "Inventario recibido" },
          { account: "1106", debit: purchase.tax, description: "IVA acreditable" },
          { account: purchase.credit ? "2101" : "1103", credit: purchase.total, description: purchase.credit ? "Credito de proveedor" : "Pago de compra" },
        ],
      });
    }
    for (const expense of expenseRows) {
      const category = expenseCategories.find((item) => item.id === expense.categoria_id);
      const expenseAccount = category?.cuenta_contable_id ?? cuentaByCode.get("6103")!;
      const entryId = randomUUID();
      accountingNumber += 1;
      const total = Number(expense.total);
      accountingRows.push({
        id: entryId, empresa_id: empresaId, periodo_id: periodByMonth.get(Number(String(expense.fecha).slice(5, 7))),
        numero: `DEM-AST-${String(accountingNumber).padStart(6, "0")}`,
        fecha: expense.fecha, concepto: String(expense.descripcion), origen: "gasto",
        referencia_tabla: "gastos", referencia_id: expense.id,
        total_debe: total, total_haber: total, estado: "registrado", usuario_id: pick(usuarioIds),
      });
      accountingLineRows.push(
        {
          id: randomUUID(), asiento_id: entryId, cuenta_id: expenseAccount,
          centro_costo_id: centerByBranch.get(String(expense.sucursal_id)),
          descripcion: expense.descripcion, debe: expense.subtotal, haber: 0, orden: 1,
        },
        ...(Number(expense.impuesto) > 0 ? [{
          id: randomUUID(), asiento_id: entryId, cuenta_id: cuentaByCode.get("1106"),
          centro_costo_id: centerByBranch.get(String(expense.sucursal_id)),
          descripcion: "IVA acreditable", debe: expense.impuesto, haber: 0, orden: 2,
        }] : []),
        {
          id: randomUUID(), asiento_id: entryId, cuenta_id: cuentaByCode.get("1103"),
          centro_costo_id: centerByBranch.get(String(expense.sucursal_id)),
          descripcion: "Salida de banco", debe: 0, haber: total, orden: 3,
        },
      );
    }
    for (const payroll of payrollAccounting) {
      addAccountingEntry({
        date: payroll.date, concept: `Devengo ${payroll.id.slice(0, 8)}`, origin: "nomina",
        referenceTable: "nominas", referenceId: payroll.id,
        lines: [
          { account: "6101", debit: payroll.devengado, description: "Sueldos y salarios" },
          { account: "2104", credit: payroll.neto, description: "Neto por pagar" },
          { account: "2103", credit: payroll.deducciones, description: "Deducciones por pagar" },
        ],
      });
      addAccountingEntry({
        date: payroll.date, concept: `Pago ${payroll.id.slice(0, 8)}`, origin: "nomina",
        referenceTable: "nominas", referenceId: payroll.id,
        lines: [
          { account: "2104", debit: payroll.neto, description: "Cancelacion de nomina" },
          { account: "1103", credit: payroll.neto, description: "Salida de banco" },
        ],
      });
    }
    await bulkInsert("asientos_contables", accountingRows, [
      "id", "empresa_id", "periodo_id", "numero", "fecha", "concepto", "origen",
      "referencia_tabla", "referencia_id", "total_debe", "total_haber", "estado", "usuario_id",
    ]);
    await bulkInsert("asiento_partidas", accountingLineRows, [
      "id", "asiento_id", "cuenta_id", "centro_costo_id", "descripcion", "debe", "haber", "orden",
    ]);

    const auditTables = ["productos", "clientes", "ventas", "compras", "empleados", "nominas", "gastos"];
    const auditRows = Array.from({ length: 70 }, (_, index) => ({
      id: randomUUID(), empresa_id: empresaId, usuario_id: usuarioIds[index % usuarioIds.length],
      accion: index % 5 === 0 ? "actualizar" : "crear", tabla: auditTables[index % auditTables.length],
      registro_id: `DEMO-${String(index + 1).padStart(5, "0")}`,
      datos_antes: index % 5 === 0 ? JSON.stringify({ estado: "anterior" }) : null,
      datos_despues: JSON.stringify({ origen: "carga_masiva_nicaris", indice: index + 1 }),
      ip: "127.0.0.1", user_agent: "ARCA Demo Seeder",
      creado_en: dateAt(saleDates[index % saleDates.length], 12),
    }));
    await bulkInsert("auditoria", auditRows, [
      "id", "empresa_id", "usuario_id", "accion", "tabla", "registro_id", "datos_antes",
      "datos_despues", "ip", "user_agent", "creado_en",
    ]);

    const markerValue = {
      version: 1,
      generadoEn: new Date().toISOString(),
      productos: productRows.length,
      clientes: customerRows.length,
      proveedores: supplierRows.length,
      empleados: employees.length,
      ventas: salesRows.length,
      facturas: invoiceRows.length,
      compras: purchaseRows.length,
      nominas: payrollRows.length,
      colillas: payslipRows.length,
    };
    await tx`
      insert into configuraciones (id, empresa_id, clave, valor)
      values (${randomUUID()}, ${empresaId}, ${MARKER_KEY}, ${JSON.stringify(markerValue)}::jsonb)
    `;

    return {
      empresa: empresa.nombre_comercial ?? empresa.razon_social,
      sucursales: sucursales.length,
      productos: productRows.length,
      clientes: customerRows.length,
      proveedores: supplierRows.length,
      empleados: employees.length,
      asistencias: attendanceRows.length,
      ventas: salesRows.length,
      facturas: invoiceRows.length,
      compras: purchaseRows.length,
      ordenesCompra: purchaseOrderRows.length,
      cotizaciones: quoteRows.length,
      movimientosInventario: inventoryMovementRows.length,
      gastos: expenseRows.length,
      movimientosTesoreria: treasuryRows.length,
      nominas: payrollRows.length,
      colillas: payslipRows.length,
      asientosContables: accountingRows.length,
    };
  });

  console.log(JSON.stringify(summary, null, 2));
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
