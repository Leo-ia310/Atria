import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cajas,
  catalogoCuentas,
  categorias,
  categoriasGasto,
  clientes,
  compras,
  cuentasFinancieras,
  cuentasPorCobrar,
  cuentasPorPagar,
  empleados,
  existencias,
  almacenes,
  asistencias,
  facturas,
  formasPago,
  gastos,
  gastosRecurrentes,
  impuestos,
  nominas,
  periodosContables,
  productos,
  proveedores,
  restauranteProductos,
  roles,
  sesionesCaja,
  solicitudesRrhh,
  sucursales,
  usuarios,
  ventas,
  ventaDetalle,
  asientosContables,
  asientoPartidas,
} from "@/lib/db/schema";
import type { SessionUser } from "@/lib/actions/session-helpers";
import type { PaisCodigo } from "@/lib/paises";
import type { ColumnaExcel, EmpresaExcel } from "@/lib/excel/builder";
import { formatearFecha } from "@/lib/utils";
import {
  TIPO_CONTRATO_LABEL,
  FRECUENCIA_LABEL,
  ESTADO_EMPLEADO_LABEL,
  ASISTENCIA_ESTADO_LABEL,
  SOLICITUD_TIPO_LABEL,
  SOLICITUD_ESTADO_LABEL,
} from "@/lib/rrhh";
import { saldosPorCuenta, calcularBalanceGeneral, calcularEstadoResultados } from "@/lib/contabilidad/queries";

const TOPE = 50_000;

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type ExportCtx = {
  user: SessionUser;
  empresa: (EmpresaExcel & { zonaHoraria?: string | null }) | null;
  pais: PaisCodigo;
  zonaHoraria: string;
  sucursalIds: string[] | null;
  params: URLSearchParams;
};

export type RecursoExport = {
  titulo: string;
  columnas: ColumnaExcel[];
  subtitulo?: (ctx: ExportCtx) => string | undefined;
  query: (ctx: ExportCtx) => Promise<Record<string, unknown>[]>;
};

function rangoFechasSubtitulo(ctx: ExportCtx): string | undefined {
  const desde = ctx.params.get("desde");
  const hasta = ctx.params.get("hasta");
  const partes: string[] = [];
  if (desde && hasta) partes.push(`Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`);
  else if (desde) partes.push(`Desde ${formatearFecha(desde)}`);
  else if (hasta) partes.push(`Hasta ${formatearFecha(hasta)}`);
  return partes.length ? partes.join(" · ") : undefined;
}

export const RECURSOS: Record<string, RecursoExport> = {
  // ─────────────────────────── Inventario ───────────────────────────
  inventario: {
    titulo: "Inventario de productos",
    columnas: [
      { header: "SKU", key: "sku", tipo: "texto", width: 16 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 34 },
      { header: "Categoría", key: "categoria", tipo: "texto", width: 20 },
      { header: "Código de barras", key: "codigoBarras", tipo: "texto", width: 20 },
      { header: "Precio", key: "precio", tipo: "moneda" },
      { header: "Costo", key: "costo", tipo: "moneda" },
      { header: "Existencia", key: "existencia", tipo: "numero", total: true },
      { header: "Stock mínimo", key: "stockMinimo", tipo: "numero" },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const stockRows = await db
        .select({
          productoId: existencias.productoId,
          existencia: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
        })
        .from(existencias)
        .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
        .where(
          and(
            eq(existencias.empresaId, ctx.user.empresaId),
            eq(almacenes.empresaId, ctx.user.empresaId),
            eq(almacenes.activo, true),
            ctx.sucursalIds ? inArray(almacenes.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .groupBy(existencias.productoId);
      const stockMap = new Map(stockRows.map((r) => [r.productoId, parseFloat(r.existencia)]));
      const idsScope = ctx.sucursalIds ? stockRows.map((r) => r.productoId) : null;

      if (idsScope && idsScope.length === 0) return [];

      const rows = await db
        .select({
          id: productos.id,
          sku: productos.sku,
          nombre: productos.nombre,
          categoria: categorias.nombre,
          codigoBarras: productos.codigoBarras,
          precio: productos.precioBase,
          costo: productos.costoPromedio,
          stockMinimo: productos.stockMinimo,
          activo: productos.activo,
        })
        .from(productos)
        .leftJoin(
          restauranteProductos,
          and(
            eq(restauranteProductos.empresaId, ctx.user.empresaId),
            eq(restauranteProductos.productoId, productos.id),
            eq(restauranteProductos.tipo, "insumo"),
          ),
        )
        .leftJoin(
          categorias,
          and(eq(categorias.id, productos.categoriaId), eq(categorias.empresaId, ctx.user.empresaId)),
        )
        .where(
          and(
            eq(productos.empresaId, ctx.user.empresaId),
            isNull(productos.eliminadoEn),
            isNull(restauranteProductos.id),
            idsScope ? inArray(productos.id, idsScope) : undefined,
          ),
        )
        .orderBy(desc(productos.creadoEn))
        .limit(TOPE);

      return rows.map((p) => ({
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria ?? "",
        codigoBarras: p.codigoBarras ?? "",
        precio: p.precio,
        costo: p.costo,
        existencia: stockMap.get(p.id) ?? 0,
        stockMinimo: p.stockMinimo,
        estado: p.activo ? "Activo" : "Inactivo",
      }));
    },
  },

  // ─────────────────────────── Clientes ───────────────────────────
  clientes: {
    titulo: "Clientes registrados",
    columnas: [
      { header: "Cliente", key: "nombre", tipo: "texto", width: 32 },
      { header: "Identificación fiscal", key: "identificacionFiscal", tipo: "texto", width: 22 },
      { header: "Teléfono", key: "telefono", tipo: "texto", width: 16 },
      { header: "Límite de crédito", key: "limiteCredito", tipo: "moneda", total: true },
      { header: "Días de crédito", key: "diasCredito", tipo: "entero" },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 18 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          nombre: clientes.nombre,
          identificacionFiscal: clientes.identificacionFiscal,
          telefono: clientes.telefono,
          limiteCredito: clientes.limiteCredito,
          diasCredito: clientes.diasCredito,
          esConsumidorFinal: clientes.esConsumidorFinal,
        })
        .from(clientes)
        .where(and(eq(clientes.empresaId, ctx.user.empresaId), isNull(clientes.eliminadoEn)))
        .orderBy(desc(clientes.creadoEn))
        .limit(TOPE);
      return rows.map((c) => ({
        nombre: c.nombre,
        identificacionFiscal: c.identificacionFiscal ?? "",
        telefono: c.telefono ?? "",
        limiteCredito: c.limiteCredito,
        diasCredito: c.diasCredito,
        tipo: c.esConsumidorFinal ? "Consumidor final" : "Registrado",
      }));
    },
  },

  // ─────────────────────────── Ventas ───────────────────────────
  ventas: {
    titulo: "Ventas",
    subtitulo: rangoFechasSubtitulo,
    columnas: [
      { header: "N.º Venta", key: "numero", tipo: "texto", width: 16 },
      { header: "Fecha y hora", key: "fecha", tipo: "fechaHora" },
      { header: "Cliente", key: "cliente", tipo: "texto", width: 28 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Total", key: "total", tipo: "moneda", total: true },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 12 },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const sp = ctx.params;
      const cond: (SQL | undefined)[] = [eq(ventas.empresaId, ctx.user.empresaId)];
      if (ctx.sucursalIds) cond.push(inArray(ventas.sucursalId, ctx.sucursalIds));
      const desde = sp.get("desde");
      const hasta = sp.get("hasta");
      if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde))
        cond.push(sql`(${ventas.fecha} AT TIME ZONE ${ctx.zonaHoraria})::date >= ${desde}`);
      if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta))
        cond.push(sql`(${ventas.fecha} AT TIME ZONE ${ctx.zonaHoraria})::date <= ${hasta}`);
      if (sp.get("tipo") === "contado") cond.push(eq(ventas.esCredito, false));
      if (sp.get("tipo") === "credito") cond.push(eq(ventas.esCredito, true));
      const estado = sp.get("estado");
      if (estado === "completada" || estado === "anulada" || estado === "pendiente")
        cond.push(eq(ventas.estado, estado));
      const q = sp.get("q");
      if (q) {
        const busqueda = or(ilike(ventas.numero, `%${q}%`), ilike(clientes.nombre, `%${q}%`));
        if (busqueda) cond.push(busqueda);
      }

      const rows = await db
        .select({
          numero: ventas.numero,
          fecha: ventas.fecha,
          cliente: clientes.nombre,
          sucursal: sucursales.nombre,
          total: ventas.total,
          esCredito: ventas.esCredito,
          estado: ventas.estado,
        })
        .from(ventas)
        .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
        .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
        .where(and(...cond))
        .orderBy(desc(ventas.fecha))
        .limit(TOPE);
      return rows.map((v) => ({
        numero: v.numero,
        fecha: v.fecha,
        cliente: v.cliente ?? "Consumidor final",
        sucursal: v.sucursal ?? "Sin sucursal",
        total: v.total,
        tipo: v.esCredito ? "Crédito" : "Contado",
        estado: v.estado === "anulada" ? "Anulada" : v.estado === "pendiente" ? "Pendiente" : "Completada",
      }));
    },
  },

  // ─────────────────────────── Compras ───────────────────────────
  compras: {
    titulo: "Compras",
    columnas: [
      { header: "Fecha", key: "fecha", tipo: "fecha" },
      { header: "Factura", key: "numeroFactura", tipo: "texto", width: 18 },
      { header: "Proveedor", key: "proveedor", tipo: "texto", width: 30 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Total", key: "total", tipo: "moneda", total: true },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 12 },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          numeroFactura: compras.numeroFactura,
          fecha: compras.fecha,
          proveedor: proveedores.razonSocial,
          sucursal: sucursales.nombre,
          total: compras.total,
          esCredito: compras.esCredito,
          estado: compras.estado,
        })
        .from(compras)
        .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
        .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
        .where(
          and(
            eq(compras.empresaId, ctx.user.empresaId),
            ctx.sucursalIds ? inArray(compras.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(compras.fecha))
        .limit(TOPE);
      return rows.map((c) => ({
        fecha: c.fecha,
        numeroFactura: c.numeroFactura ?? "",
        proveedor: c.proveedor,
        sucursal: c.sucursal ?? "Sin sucursal",
        total: c.total,
        tipo: c.esCredito ? "Crédito" : "Contado",
        estado: c.estado === "anulada" ? "Anulada" : c.estado,
      }));
    },
  },

  // ─────────────────────────── Proveedores ───────────────────────────
  proveedores: {
    titulo: "Proveedores",
    columnas: [
      { header: "Proveedor", key: "razonSocial", tipo: "texto", width: 32 },
      { header: "Identificación fiscal", key: "identificacionFiscal", tipo: "texto", width: 22 },
      { header: "Teléfono", key: "telefono", tipo: "texto", width: 16 },
      { header: "Días de crédito", key: "diasCredito", tipo: "entero" },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          razonSocial: proveedores.razonSocial,
          identificacionFiscal: proveedores.identificacionFiscal,
          telefono: proveedores.telefono,
          diasCredito: proveedores.diasCredito,
        })
        .from(proveedores)
        .where(and(eq(proveedores.empresaId, ctx.user.empresaId), isNull(proveedores.eliminadoEn)))
        .orderBy(desc(proveedores.creadoEn))
        .limit(TOPE);
      return rows.map((p) => ({
        razonSocial: p.razonSocial,
        identificacionFiscal: p.identificacionFiscal ?? "",
        telefono: p.telefono ?? "",
        diasCredito: p.diasCredito,
      }));
    },
  },

  // ─────────────────────────── CxC ───────────────────────────
  cxc: {
    titulo: "Cuentas por cobrar",
    columnas: [
      { header: "Cliente", key: "cliente", tipo: "texto", width: 30 },
      { header: "Venta", key: "ventaNumero", tipo: "texto", width: 16 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Emisión", key: "fechaEmision", tipo: "fecha" },
      { header: "Vencimiento", key: "fechaVencimiento", tipo: "fecha" },
      { header: "Total factura", key: "monto", tipo: "moneda", total: true },
      { header: "Saldo pendiente", key: "saldo", tipo: "moneda", total: true },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const clienteId = ctx.params.get("clienteId");
      const rows = await db
        .select({
          cliente: clientes.nombre,
          ventaNumero: ventas.numero,
          sucursal: sucursales.nombre,
          fechaEmision: cuentasPorCobrar.fechaEmision,
          fechaVencimiento: cuentasPorCobrar.fechaVencimiento,
          monto: cuentasPorCobrar.monto,
          saldo: cuentasPorCobrar.saldo,
          estado: cuentasPorCobrar.estado,
        })
        .from(cuentasPorCobrar)
        .innerJoin(clientes, eq(clientes.id, cuentasPorCobrar.clienteId))
        .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
        .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
        .where(
          and(
            eq(cuentasPorCobrar.empresaId, ctx.user.empresaId),
            notInArray(cuentasPorCobrar.estado, ["pagada", "incobrable"]),
            clienteId ? eq(cuentasPorCobrar.clienteId, clienteId) : undefined,
            ctx.sucursalIds ? inArray(ventas.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(cuentasPorCobrar.fechaVencimiento))
        .limit(TOPE);
      return rows.map((r) => ({
        cliente: r.cliente,
        ventaNumero: r.ventaNumero ?? "",
        sucursal: r.sucursal ?? "Sin sucursal",
        fechaEmision: r.fechaEmision,
        fechaVencimiento: r.fechaVencimiento,
        monto: r.monto,
        saldo: r.saldo,
        estado: r.estado.charAt(0).toUpperCase() + r.estado.slice(1),
      }));
    },
  },

  // ─────────────────────────── CxP ───────────────────────────
  cxp: {
    titulo: "Cuentas por pagar",
    columnas: [
      { header: "Proveedor", key: "proveedor", tipo: "texto", width: 30 },
      { header: "Factura", key: "compraNumero", tipo: "texto", width: 16 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Emisión", key: "fechaEmision", tipo: "fecha" },
      { header: "Vencimiento", key: "fechaVencimiento", tipo: "fecha" },
      { header: "Total factura", key: "monto", tipo: "moneda", total: true },
      { header: "Saldo pendiente", key: "saldo", tipo: "moneda", total: true },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const proveedorId = ctx.params.get("proveedorId");
      const rows = await db
        .select({
          proveedor: proveedores.razonSocial,
          compraNumero: compras.numeroFactura,
          sucursal: sucursales.nombre,
          fechaEmision: cuentasPorPagar.fechaEmision,
          fechaVencimiento: cuentasPorPagar.fechaVencimiento,
          monto: cuentasPorPagar.monto,
          saldo: cuentasPorPagar.saldo,
          estado: cuentasPorPagar.estado,
        })
        .from(cuentasPorPagar)
        .innerJoin(proveedores, eq(proveedores.id, cuentasPorPagar.proveedorId))
        .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
        .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
        .where(
          and(
            eq(cuentasPorPagar.empresaId, ctx.user.empresaId),
            notInArray(cuentasPorPagar.estado, ["pagada"]),
            proveedorId ? eq(cuentasPorPagar.proveedorId, proveedorId) : undefined,
            ctx.sucursalIds ? inArray(compras.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(cuentasPorPagar.fechaVencimiento))
        .limit(TOPE);
      return rows.map((r) => ({
        proveedor: r.proveedor,
        compraNumero: r.compraNumero ?? "",
        sucursal: r.sucursal ?? "Sin sucursal",
        fechaEmision: r.fechaEmision,
        fechaVencimiento: r.fechaVencimiento,
        monto: r.monto,
        saldo: r.saldo,
        estado: r.estado.charAt(0).toUpperCase() + r.estado.slice(1),
      }));
    },
  },

  // ─────────────────────────── Libro Diario ───────────────────────────
  "libro-diario": {
    titulo: "Libro Diario",
    subtitulo: rangoFechasSubtitulo,
    columnas: [
      { header: "Fecha", key: "fecha", tipo: "fecha" },
      { header: "N.º Asiento", key: "numero", tipo: "texto", width: 16 },
      { header: "Origen", key: "origen", tipo: "texto", width: 16 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 38 },
      { header: "Detalle", key: "detalle", tipo: "texto", width: 34 },
      { header: "Debe", key: "debe", tipo: "moneda", total: true },
      { header: "Haber", key: "haber", tipo: "moneda", total: true },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const filtros: (SQL | undefined)[] = [eq(asientosContables.empresaId, ctx.user.empresaId)];
      const desde = ctx.params.get("desde");
      const hasta = ctx.params.get("hasta");
      if (desde) filtros.push(sql`${asientosContables.fecha} >= ${desde}`);
      if (hasta) filtros.push(sql`${asientosContables.fecha} <= ${hasta}`);
      if (ctx.sucursalIds) filtros.push(inArray(asientosContables.sucursalId, ctx.sucursalIds));

      const rows = await db
        .select({
          fecha: asientosContables.fecha,
          numero: asientosContables.numero,
          origen: asientosContables.origen,
          estado: asientosContables.estado,
          codigo: catalogoCuentas.codigo,
          cuenta: catalogoCuentas.nombre,
          descripcion: asientoPartidas.descripcion,
          debe: asientoPartidas.debe,
          haber: asientoPartidas.haber,
          orden: asientoPartidas.orden,
        })
        .from(asientoPartidas)
        .innerJoin(asientosContables, eq(asientosContables.id, asientoPartidas.asientoId))
        .innerJoin(catalogoCuentas, eq(catalogoCuentas.id, asientoPartidas.cuentaId))
        .where(and(...filtros))
        .orderBy(asc(asientosContables.fecha), asc(asientosContables.numero), asc(asientoPartidas.orden))
        .limit(TOPE);

      return rows.map((r) => ({
        fecha: r.fecha,
        numero: r.numero,
        origen: r.origen,
        cuenta: `${r.codigo} · ${r.cuenta}`,
        detalle: r.descripcion ?? "",
        debe: r.debe,
        haber: r.haber,
        estado: r.estado === "anulado" ? "Anulado" : "Registrado",
      }));
    },
  },

  // ─────────────────────────── Libro Mayor ───────────────────────────
  "libro-mayor": {
    titulo: "Libro Mayor",
    subtitulo(ctx) {
      return ctx.params.get("_cuentaEtiqueta") ?? undefined;
    },
    columnas: [
      { header: "Fecha", key: "fecha", tipo: "fecha" },
      { header: "Asiento", key: "numero", tipo: "texto", width: 16 },
      { header: "Detalle", key: "detalle", tipo: "texto", width: 40 },
      { header: "Debe", key: "debe", tipo: "moneda", total: true },
      { header: "Haber", key: "haber", tipo: "moneda", total: true },
      { header: "Saldo", key: "saldo", tipo: "moneda" },
    ],
    async query(ctx) {
      const cuentas = await db
        .select({
          id: catalogoCuentas.id,
          codigo: catalogoCuentas.codigo,
          nombre: catalogoCuentas.nombre,
          naturaleza: catalogoCuentas.naturaleza,
        })
        .from(catalogoCuentas)
        .where(and(eq(catalogoCuentas.empresaId, ctx.user.empresaId), eq(catalogoCuentas.esDetalle, true)))
        .orderBy(asc(catalogoCuentas.codigo));

      const cuentaParam = ctx.params.get("cuenta");
      const cuenta = cuentaParam ? cuentas.find((c) => c.id === cuentaParam) : cuentas[0];
      if (!cuenta) return [];
      ctx.params.set("_cuentaEtiqueta", `Cuenta ${cuenta.codigo} · ${cuenta.nombre}`);

      const movimientos = await db
        .select({
          fecha: asientosContables.fecha,
          numero: asientosContables.numero,
          concepto: asientosContables.concepto,
          descripcion: asientoPartidas.descripcion,
          debe: asientoPartidas.debe,
          haber: asientoPartidas.haber,
        })
        .from(asientoPartidas)
        .innerJoin(asientosContables, eq(asientosContables.id, asientoPartidas.asientoId))
        .where(
          and(
            eq(asientoPartidas.cuentaId, cuenta.id),
            eq(asientosContables.empresaId, ctx.user.empresaId),
            eq(asientosContables.estado, "registrado"),
            ctx.sucursalIds ? inArray(asientosContables.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(asc(asientosContables.fecha), asc(asientosContables.numero))
        .limit(TOPE);

      let saldo = 0;
      return movimientos.map((m) => {
        const debe = parseFloat(m.debe);
        const haber = parseFloat(m.haber);
        saldo += cuenta.naturaleza === "deudora" ? debe - haber : haber - debe;
        return {
          fecha: m.fecha,
          numero: m.numero,
          detalle: m.descripcion ?? m.concepto,
          debe,
          haber,
          saldo,
        };
      });
    },
  },

  // ─────────────────────── Balance de Comprobación ───────────────────────
  "balance-comprobacion": {
    titulo: "Balance de Comprobación",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 40 },
      { header: "Debe", key: "totalDebe", tipo: "moneda", total: true },
      { header: "Haber", key: "totalHaber", tipo: "moneda", total: true },
      { header: "Saldo deudor", key: "saldoDeudor", tipo: "moneda", total: true },
      { header: "Saldo acreedor", key: "saldoAcreedor", tipo: "moneda", total: true },
    ],
    async query(ctx) {
      const saldos = await saldosPorCuenta(ctx.user.empresaId, undefined, ctx.sucursalIds);
      return saldos.map((s) => ({
        codigo: s.codigo,
        cuenta: s.nombre,
        totalDebe: s.totalDebe,
        totalHaber: s.totalHaber,
        saldoDeudor: s.naturaleza === "deudora" ? s.saldo : 0,
        saldoAcreedor: s.naturaleza === "acreedora" ? s.saldo : 0,
      }));
    },
  },

  // ─────────────────────────── Balance General ───────────────────────────
  "balance-general": {
    titulo: "Balance General",
    columnas: [
      { header: "Grupo", key: "grupo", tipo: "texto", width: 20 },
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 40 },
      { header: "Saldo", key: "saldo", tipo: "moneda", total: true },
    ],
    async query(ctx) {
      const saldos = await saldosPorCuenta(ctx.user.empresaId, undefined, ctx.sucursalIds);
      const bg = calcularBalanceGeneral(saldos);
      const filas: Record<string, unknown>[] = [];
      for (const a of bg.activos) filas.push({ grupo: "Activo", codigo: a.codigo, cuenta: a.nombre, saldo: a.saldo });
      for (const p of bg.pasivos) filas.push({ grupo: "Pasivo", codigo: p.codigo, cuenta: p.nombre, saldo: p.saldo });
      for (const p of bg.patrimonio) filas.push({ grupo: "Patrimonio", codigo: p.codigo, cuenta: p.nombre, saldo: p.saldo });
      filas.push({ grupo: "Patrimonio", codigo: "", cuenta: "Utilidad del ejercicio", saldo: bg.utilidadEjercicio });
      return filas;
    },
  },

  // ─────────────────────────── Estado de Resultados ───────────────────────────
  "estado-resultados": {
    titulo: "Estado de Resultados",
    columnas: [
      { header: "Sección", key: "seccion", tipo: "texto", width: 20 },
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 40 },
      { header: "Monto", key: "monto", tipo: "moneda" },
    ],
    async query(ctx) {
      const saldos = await saldosPorCuenta(ctx.user.empresaId, undefined, ctx.sucursalIds);
      const er = calcularEstadoResultados(saldos);
      const filas: Record<string, unknown>[] = [];
      for (const i of er.ingresos) filas.push({ seccion: "Ingresos", codigo: i.codigo, cuenta: i.nombre, monto: i.saldo });
      filas.push({ seccion: "Ingresos", codigo: "", cuenta: "Total ingresos", monto: er.totalIngresos });
      for (const c of er.costos) filas.push({ seccion: "Costos", codigo: c.codigo, cuenta: c.nombre, monto: c.saldo });
      filas.push({ seccion: "Resultado", codigo: "", cuenta: "Utilidad bruta", monto: er.utilidadBruta });
      for (const g of er.gastos) filas.push({ seccion: "Gastos", codigo: g.codigo, cuenta: g.nombre, monto: g.saldo });
      filas.push({ seccion: "Resultado", codigo: "", cuenta: "Utilidad neta", monto: er.utilidadNeta });
      return filas;
    },
  },

  // ─────────────────────────── Catálogo de Cuentas ───────────────────────────
  "catalogo-cuentas": {
    titulo: "Catálogo de Cuentas",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 16 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 42 },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 16 },
      { header: "Naturaleza", key: "naturaleza", tipo: "texto", width: 16 },
      { header: "Es de detalle", key: "detalle", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: catalogoCuentas.codigo,
          nombre: catalogoCuentas.nombre,
          tipo: catalogoCuentas.tipo,
          naturaleza: catalogoCuentas.naturaleza,
          esDetalle: catalogoCuentas.esDetalle,
        })
        .from(catalogoCuentas)
        .where(eq(catalogoCuentas.empresaId, ctx.user.empresaId))
        .orderBy(asc(catalogoCuentas.codigo));
      return rows.map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        detalle: c.esDetalle ? "Sí" : "No",
      }));
    },
  },

  // ─────────────────────────── Períodos Contables ───────────────────────────
  periodos: {
    titulo: "Periodos Contables",
    columnas: [
      { header: "Periodo", key: "periodo", tipo: "texto", width: 20 },
      { header: "Fecha inicio", key: "fechaInicio", tipo: "fecha" },
      { header: "Fecha fin", key: "fechaFin", tipo: "fecha" },
      { header: "Asientos", key: "numAsientos", tipo: "entero" },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const filtros: SQL[] = [
        eq(asientosContables.periodoId, periodosContables.id),
        eq(asientosContables.estado, "registrado"),
      ];
      if (ctx.sucursalIds) filtros.push(inArray(asientosContables.sucursalId, ctx.sucursalIds));

      const rows = await db
        .select({
          anio: periodosContables.anio,
          mes: periodosContables.mes,
          fechaInicio: periodosContables.fechaInicio,
          fechaFin: periodosContables.fechaFin,
          estado: periodosContables.estado,
          numAsientos: sql<number>`count(${asientosContables.id})`,
        })
        .from(periodosContables)
        .leftJoin(asientosContables, and(...filtros))
        .where(eq(periodosContables.empresaId, ctx.user.empresaId))
        .groupBy(
          periodosContables.id,
          periodosContables.anio,
          periodosContables.mes,
          periodosContables.fechaInicio,
          periodosContables.fechaFin,
          periodosContables.estado,
        )
        .orderBy(desc(periodosContables.anio), desc(periodosContables.mes));

      return rows.map((p) => ({
        periodo: `${MESES_ES[p.mes - 1]} ${p.anio}`,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin,
        numAsientos: Number(p.numAsientos),
        estado: p.estado === "abierto" ? "Abierto" : "Cerrado",
      }));
    },
  },

  // ─────────────────────────── Gastos ───────────────────────────
  gastos: {
    titulo: "Gastos",
    columnas: [
      { header: "Fecha", key: "fecha", tipo: "fecha" },
      { header: "Descripción", key: "descripcion", tipo: "texto", width: 34 },
      { header: "Referencia", key: "referencia", tipo: "texto", width: 18 },
      { header: "Categoría", key: "categoria", tipo: "texto", width: 20 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 20 },
      { header: "Subtotal", key: "subtotal", tipo: "moneda", total: true },
      { header: "Impuesto", key: "impuesto", tipo: "moneda", total: true },
      { header: "Total", key: "total", tipo: "moneda", total: true },
      { header: "Recurrente", key: "recurrente", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          fecha: gastos.fecha,
          descripcion: gastos.descripcion,
          referencia: gastos.referencia,
          categoria: categoriasGasto.nombre,
          cuenta: cuentasFinancieras.nombre,
          subtotal: gastos.subtotal,
          impuesto: gastos.impuesto,
          total: gastos.total,
          recurrenteId: gastos.recurrenteId,
        })
        .from(gastos)
        .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
        .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastos.cuentaFinancieraId))
        .where(eq(gastos.empresaId, ctx.user.empresaId))
        .orderBy(desc(gastos.fecha), desc(gastos.creadoEn))
        .limit(TOPE);
      return rows.map((g) => ({
        fecha: g.fecha,
        descripcion: g.descripcion,
        referencia: g.referencia ?? "",
        categoria: g.categoria,
        cuenta: g.cuenta,
        subtotal: g.subtotal,
        impuesto: g.impuesto,
        total: g.total,
        recurrente: g.recurrenteId ? "Sí" : "No",
      }));
    },
  },

  // ─────────────────────────── Sesiones de Caja ───────────────────────────
  caja: {
    titulo: "Sesiones de caja",
    columnas: [
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
      { header: "Caja", key: "caja", tipo: "texto", width: 20 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Usuario", key: "usuario", tipo: "texto", width: 22 },
      { header: "Apertura", key: "apertura", tipo: "fechaHora" },
      { header: "Cierre", key: "cierre", tipo: "fechaHora" },
      { header: "Monto inicial", key: "montoInicial", tipo: "moneda" },
      { header: "Monto final", key: "montoFinal", tipo: "moneda" },
      { header: "Diferencia", key: "diferencia", tipo: "moneda", total: true },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          estado: sesionesCaja.estado,
          caja: cajas.nombre,
          sucursal: sucursales.nombre,
          usuario: usuarios.nombre,
          apertura: sesionesCaja.abiertaEn,
          cierre: sesionesCaja.cerradaEn,
          montoInicial: sesionesCaja.montoInicial,
          montoFinal: sesionesCaja.montoFinalReal,
          diferencia: sesionesCaja.diferencia,
        })
        .from(sesionesCaja)
        .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
        .innerJoin(usuarios, eq(usuarios.id, sesionesCaja.usuarioId))
        .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
        .where(
          and(
            eq(sesionesCaja.empresaId, ctx.user.empresaId),
            eq(cajas.empresaId, ctx.user.empresaId),
            eq(usuarios.empresaId, ctx.user.empresaId),
            ctx.sucursalIds ? inArray(cajas.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(sesionesCaja.abiertaEn))
        .limit(TOPE);
      return rows.map((s) => ({
        estado: s.estado === "abierta" ? "Abierta" : "Cerrada",
        caja: s.caja,
        sucursal: s.sucursal ?? "Sin sucursal",
        usuario: s.usuario,
        apertura: s.apertura,
        cierre: s.cierre,
        montoInicial: s.montoInicial,
        montoFinal: s.montoFinal,
        diferencia: s.diferencia,
      }));
    },
  },

  // ─────────────────────────── Facturas al crédito ───────────────────────────
  "facturas-credito": {
    titulo: "Facturas al crédito",
    subtitulo: rangoFechasSubtitulo,
    columnas: [
      { header: "Factura", key: "numero", tipo: "texto", width: 16 },
      { header: "Fecha y hora", key: "fecha", tipo: "fechaHora" },
      { header: "Cliente", key: "cliente", tipo: "texto", width: 28 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Vendedor", key: "vendedor", tipo: "texto", width: 22 },
      { header: "Vencimiento", key: "vencimiento", tipo: "fecha" },
      { header: "Saldo CxC", key: "saldo", tipo: "moneda", total: true },
      { header: "Total", key: "total", tipo: "moneda", total: true },
      { header: "Estado CxC", key: "estadoCxc", tipo: "texto", width: 14 },
    ],
    query: (ctx) => queryFacturas(ctx, true),
  },

  // ─────────────────────────── Facturas cobradas ───────────────────────────
  "facturas-cobradas": {
    titulo: "Facturas cobradas",
    subtitulo: rangoFechasSubtitulo,
    columnas: [
      { header: "Factura", key: "numero", tipo: "texto", width: 16 },
      { header: "Fecha y hora", key: "fecha", tipo: "fechaHora" },
      { header: "Cliente", key: "cliente", tipo: "texto", width: 28 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Vendedor", key: "vendedor", tipo: "texto", width: 22 },
      { header: "Formas de pago", key: "formasPago", tipo: "texto", width: 22 },
      { header: "Total", key: "total", tipo: "moneda", total: true },
    ],
    query: (ctx) => queryFacturas(ctx, false),
  },

  // ─────────────────────────── Empleados ───────────────────────────
  empleados: {
    titulo: "Empleados",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Nombres", key: "nombres", tipo: "texto", width: 22 },
      { header: "Apellidos", key: "apellidos", tipo: "texto", width: 22 },
      { header: "Puesto", key: "puesto", tipo: "texto", width: 22 },
      { header: "Departamento", key: "departamento", tipo: "texto", width: 20 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 18 },
      { header: "Contrato", key: "contrato", tipo: "texto", width: 18 },
      { header: "Salario", key: "salarioBase", tipo: "moneda", total: true },
      { header: "Frecuencia", key: "frecuencia", tipo: "texto", width: 14 },
      { header: "Estado", key: "estado", tipo: "texto", width: 16 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: empleados.codigo,
          nombres: empleados.nombres,
          apellidos: empleados.apellidos,
          sucursal: sucursales.nombre,
          puesto: empleados.puesto,
          departamento: empleados.departamento,
          tipoContrato: empleados.tipoContrato,
          salarioBase: empleados.salarioBase,
          frecuenciaPago: empleados.frecuenciaPago,
          estado: empleados.estado,
        })
        .from(empleados)
        .leftJoin(sucursales, eq(sucursales.id, empleados.sucursalId))
        .where(
          and(
            eq(empleados.empresaId, ctx.user.empresaId),
            isNull(empleados.eliminadoEn),
            ctx.sucursalIds ? inArray(empleados.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(empleados.creadoEn))
        .limit(TOPE);
      return rows.map((e) => ({
        codigo: e.codigo,
        nombres: e.nombres,
        apellidos: e.apellidos,
        puesto: e.puesto,
        departamento: e.departamento ?? "",
        sucursal: e.sucursal ?? "Sin asignar",
        contrato: TIPO_CONTRATO_LABEL[e.tipoContrato] ?? e.tipoContrato,
        salarioBase: e.salarioBase,
        frecuencia: FRECUENCIA_LABEL[e.frecuenciaPago] ?? e.frecuenciaPago,
        estado: ESTADO_EMPLEADO_LABEL[e.estado] ?? e.estado,
      }));
    },
  },

  // ─────────────────────────── Nómina ───────────────────────────
  nomina: {
    titulo: "Nóminas",
    columnas: [
      { header: "N.º", key: "numero", tipo: "texto", width: 16 },
      { header: "Descripción", key: "descripcion", tipo: "texto", width: 30 },
      { header: "Frecuencia", key: "frecuencia", tipo: "texto", width: 14 },
      { header: "Período inicio", key: "periodoInicio", tipo: "fecha" },
      { header: "Período fin", key: "periodoFin", tipo: "fecha" },
      { header: "Fecha pago", key: "fechaPago", tipo: "fecha" },
      { header: "Empleados", key: "empleadosCount", tipo: "entero" },
      { header: "Neto", key: "totalNeto", tipo: "moneda", total: true },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          numero: nominas.numero,
          descripcion: nominas.descripcion,
          frecuencia: nominas.frecuencia,
          periodoInicio: nominas.periodoInicio,
          periodoFin: nominas.periodoFin,
          fechaPago: nominas.fechaPago,
          estado: nominas.estado,
          empleadosCount: nominas.empleadosCount,
          totalNeto: nominas.totalNeto,
        })
        .from(nominas)
        .where(eq(nominas.empresaId, ctx.user.empresaId))
        .orderBy(desc(nominas.creadoEn))
        .limit(TOPE);
      return rows.map((n) => ({
        numero: n.numero,
        descripcion: n.descripcion,
        frecuencia: FRECUENCIA_LABEL[n.frecuencia] ?? n.frecuencia,
        periodoInicio: n.periodoInicio,
        periodoFin: n.periodoFin,
        fechaPago: n.fechaPago,
        empleadosCount: n.empleadosCount,
        totalNeto: n.totalNeto,
        estado: n.estado.charAt(0).toUpperCase() + n.estado.slice(1),
      }));
    },
  },

  // ─────────────────────────── Asistencia (historial) ───────────────────────────
  "asistencia-historial": {
    titulo: "Historial de asistencias",
    subtitulo: rangoFechasSubtitulo,
    columnas: [
      { header: "Fecha", key: "fecha", tipo: "fecha" },
      { header: "Empleado", key: "empleado", tipo: "texto", width: 30 },
      { header: "Estado", key: "estado", tipo: "texto", width: 16 },
      { header: "Horas", key: "horasTrabajadas", tipo: "numero" },
      { header: "Horas extra", key: "horasExtra", tipo: "numero" },
      { header: "Notas", key: "notas", tipo: "texto", width: 34 },
    ],
    async query(ctx) {
      const desde = ctx.params.get("desde");
      const hasta = ctx.params.get("hasta");
      const cond: (SQL | undefined)[] = [
        eq(asistencias.empresaId, ctx.user.empresaId),
        eq(empleados.empresaId, ctx.user.empresaId),
        isNull(empleados.eliminadoEn),
      ];
      if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) cond.push(sql`${asistencias.fecha} >= ${desde}`);
      if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) cond.push(sql`${asistencias.fecha} <= ${hasta}`);
      const empleado = ctx.params.get("empleado");
      if (empleado) cond.push(eq(asistencias.empleadoId, empleado));
      if (ctx.sucursalIds) cond.push(inArray(empleados.sucursalId, ctx.sucursalIds));

      const rows = await db
        .select({
          fecha: asistencias.fecha,
          estado: asistencias.estado,
          horasTrabajadas: asistencias.horasTrabajadas,
          horasExtra: asistencias.horasExtra,
          notas: asistencias.notas,
          nombres: empleados.nombres,
          apellidos: empleados.apellidos,
        })
        .from(asistencias)
        .innerJoin(empleados, eq(empleados.id, asistencias.empleadoId))
        .where(and(...cond))
        .orderBy(desc(asistencias.fecha), empleados.nombres)
        .limit(TOPE);
      return rows.map((r) => ({
        fecha: r.fecha,
        empleado: `${r.nombres} ${r.apellidos}`,
        estado: ASISTENCIA_ESTADO_LABEL[r.estado] ?? r.estado,
        horasTrabajadas: r.horasTrabajadas,
        horasExtra: r.horasExtra,
        notas: r.notas ?? "",
      }));
    },
  },

  // ─────────────────────────── Solicitudes ───────────────────────────
  solicitudes: {
    titulo: "Solicitudes de RRHH",
    columnas: [
      { header: "Empleado", key: "empleado", tipo: "texto", width: 30 },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 20 },
      { header: "Estado", key: "estado", tipo: "texto", width: 14 },
      { header: "Fecha inicio", key: "fechaInicio", tipo: "fecha" },
      { header: "Fecha fin", key: "fechaFin", tipo: "fecha" },
      { header: "Días", key: "dias", tipo: "numero" },
      { header: "Monto", key: "monto", tipo: "moneda", total: true },
      { header: "Motivo", key: "motivo", tipo: "texto", width: 34 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          tipo: solicitudesRrhh.tipo,
          estado: solicitudesRrhh.estado,
          fechaInicio: solicitudesRrhh.fechaInicio,
          fechaFin: solicitudesRrhh.fechaFin,
          dias: solicitudesRrhh.dias,
          monto: solicitudesRrhh.monto,
          motivo: solicitudesRrhh.motivo,
          nombres: empleados.nombres,
          apellidos: empleados.apellidos,
        })
        .from(solicitudesRrhh)
        .innerJoin(empleados, eq(empleados.id, solicitudesRrhh.empleadoId))
        .where(
          and(
            eq(solicitudesRrhh.empresaId, ctx.user.empresaId),
            eq(empleados.empresaId, ctx.user.empresaId),
            isNull(empleados.eliminadoEn),
            ctx.sucursalIds ? inArray(empleados.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(solicitudesRrhh.creadoEn))
        .limit(TOPE);
      return rows.map((s) => ({
        empleado: `${s.nombres ?? ""} ${s.apellidos ?? ""}`.trim(),
        tipo: SOLICITUD_TIPO_LABEL[s.tipo] ?? s.tipo,
        estado: SOLICITUD_ESTADO_LABEL[s.estado] ?? s.estado,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        dias: s.dias,
        monto: s.monto ?? 0,
        motivo: s.motivo ?? "",
      }));
    },
  },

  // ─────────────────────────── Gastos recurrentes ───────────────────────────
  "gastos-recurrentes": {
    titulo: "Gastos recurrentes",
    columnas: [
      { header: "Descripción", key: "descripcion", tipo: "texto", width: 34 },
      { header: "Referencia", key: "referencia", tipo: "texto", width: 18 },
      { header: "Categoría", key: "categoria", tipo: "texto", width: 20 },
      { header: "Cuenta", key: "cuenta", tipo: "texto", width: 20 },
      { header: "Subtotal", key: "subtotal", tipo: "moneda", total: true },
      { header: "Impuesto", key: "impuesto", tipo: "moneda", total: true },
      { header: "Día del mes", key: "diaMes", tipo: "entero" },
      { header: "Próxima fecha", key: "proximaFecha", tipo: "fecha" },
      { header: "Activa", key: "activa", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          descripcion: gastosRecurrentes.descripcion,
          referencia: gastosRecurrentes.referencia,
          categoria: categoriasGasto.nombre,
          cuenta: cuentasFinancieras.nombre,
          subtotal: gastosRecurrentes.subtotal,
          impuesto: gastosRecurrentes.impuesto,
          diaMes: gastosRecurrentes.diaMes,
          proximaFecha: gastosRecurrentes.proximaFecha,
          activa: gastosRecurrentes.activa,
        })
        .from(gastosRecurrentes)
        .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastosRecurrentes.categoriaId))
        .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastosRecurrentes.cuentaFinancieraId))
        .where(eq(gastosRecurrentes.empresaId, ctx.user.empresaId))
        .orderBy(gastosRecurrentes.proximaFecha)
        .limit(TOPE);
      return rows.map((g) => ({
        descripcion: g.descripcion,
        referencia: g.referencia ?? "",
        categoria: g.categoria,
        cuenta: g.cuenta,
        subtotal: g.subtotal,
        impuesto: g.impuesto,
        diaMes: g.diaMes,
        proximaFecha: g.proximaFecha,
        activa: g.activa ? "Sí" : "No",
      }));
    },
  },

  // ─────────────────────────── Cuentas financieras ───────────────────────────
  "tesoreria-cuentas": {
    titulo: "Cuentas financieras",
    columnas: [
      { header: "Nombre", key: "nombre", tipo: "texto", width: 28 },
      { header: "Tipo", key: "tipo", tipo: "texto", width: 16 },
      { header: "Banco", key: "banco", tipo: "texto", width: 22 },
      { header: "N.º de cuenta", key: "numeroCuenta", tipo: "texto", width: 20 },
      { header: "Moneda", key: "moneda", tipo: "texto", width: 12 },
      { header: "Saldo actual", key: "saldoActual", tipo: "moneda", total: true },
      { header: "Activa", key: "activa", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          nombre: cuentasFinancieras.nombre,
          tipo: cuentasFinancieras.tipo,
          banco: cuentasFinancieras.banco,
          numeroCuenta: cuentasFinancieras.numeroCuenta,
          moneda: cuentasFinancieras.moneda,
          saldoActual: cuentasFinancieras.saldoActual,
          activa: cuentasFinancieras.activa,
        })
        .from(cuentasFinancieras)
        .where(eq(cuentasFinancieras.empresaId, ctx.user.empresaId))
        .orderBy(cuentasFinancieras.tipo, cuentasFinancieras.nombre)
        .limit(TOPE);
      return rows.map((c) => ({
        nombre: c.nombre,
        tipo: c.tipo,
        banco: c.banco ?? "",
        numeroCuenta: c.numeroCuenta ?? "",
        moneda: c.moneda,
        saldoActual: c.saldoActual,
        activa: c.activa ? "Sí" : "No",
      }));
    },
  },

  // ─────────────────────────── Reporte de inventario ───────────────────────────
  "reportes-inventario": {
    titulo: "Reporte de inventario valorizado",
    columnas: [
      { header: "SKU", key: "sku", tipo: "texto", width: 16 },
      { header: "Producto", key: "nombre", tipo: "texto", width: 34 },
      { header: "Stock actual", key: "stock", tipo: "numero", total: true },
      { header: "Stock mínimo", key: "stockMinimo", tipo: "numero" },
      { header: "Costo promedio", key: "costo", tipo: "moneda" },
      { header: "Valor en stock", key: "valor", tipo: "moneda", total: true },
      { header: "Estado", key: "estado", tipo: "texto", width: 16 },
    ],
    async query(ctx) {
      const stockRows = await db
        .select({
          productoId: existencias.productoId,
          stockTotal: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
        })
        .from(existencias)
        .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
        .where(
          and(
            eq(existencias.empresaId, ctx.user.empresaId),
            eq(almacenes.empresaId, ctx.user.empresaId),
            eq(almacenes.activo, true),
            ctx.sucursalIds ? inArray(almacenes.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .groupBy(existencias.productoId);
      const stockMap = new Map(stockRows.map((r) => [r.productoId, r.stockTotal]));
      const idsScope = ctx.sucursalIds ? stockRows.map((r) => r.productoId) : null;
      if (idsScope && idsScope.length === 0) return [];

      const rows = await db
        .select({
          productoId: productos.id,
          nombre: productos.nombre,
          sku: productos.sku,
          stockMinimo: productos.stockMinimo,
          costoPromedio: productos.costoPromedio,
        })
        .from(productos)
        .leftJoin(
          restauranteProductos,
          and(
            eq(restauranteProductos.empresaId, ctx.user.empresaId),
            eq(restauranteProductos.productoId, productos.id),
            eq(restauranteProductos.tipo, "insumo"),
          ),
        )
        .where(
          and(
            eq(productos.empresaId, ctx.user.empresaId),
            eq(productos.activo, true),
            isNull(productos.eliminadoEn),
            isNull(restauranteProductos.id),
            idsScope ? inArray(productos.id, idsScope) : undefined,
          ),
        )
        .limit(TOPE);

      return rows
        .map((p) => {
          const stock = parseFloat(stockMap.get(p.productoId) ?? "0");
          const costo = parseFloat(p.costoPromedio);
          const stockMinimo = parseFloat(p.stockMinimo);
          return {
            sku: p.sku,
            nombre: p.nombre,
            stock,
            stockMinimo,
            costo,
            valor: stock * costo,
            estado: stock <= 0 ? "Sin stock" : stock < stockMinimo ? "Bajo mínimo" : "En nivel",
          };
        })
        .sort((a, b) => b.valor - a.valor);
    },
  },

  // ─────────────────────────── Reporte de rentabilidad ───────────────────────────
  "reportes-rentabilidad": {
    titulo: "Rentabilidad por mes (12 meses)",
    columnas: [
      { header: "Período", key: "periodo", tipo: "texto", width: 18 },
      { header: "Ingresos", key: "ingresos", tipo: "moneda", total: true },
      { header: "Costo de ventas", key: "costos", tipo: "moneda", total: true },
      { header: "Margen bruto", key: "margen", tipo: "moneda", total: true },
      { header: "% Margen", key: "pctMargen", tipo: "porcentaje" },
    ],
    async query(ctx) {
      const hace12 = new Date();
      hace12.setFullYear(hace12.getFullYear() - 1);
      hace12.setDate(1);
      const periodoExpr = sql<string>`TO_CHAR(${ventas.fecha}, 'YYYY-MM')`;
      const rows = await db
        .select({
          periodo: periodoExpr,
          ingresos: sql<string>`COALESCE(SUM(${ventas.total}), 0)`,
          costos: sql<string>`COALESCE(SUM(${ventas.costoTotal}), 0)`,
        })
        .from(ventas)
        .where(
          and(
            eq(ventas.empresaId, ctx.user.empresaId),
            eq(ventas.estado, "completada"),
            sql`${ventas.fecha} >= ${hace12}`,
            ctx.sucursalIds ? inArray(ventas.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .groupBy(periodoExpr)
        .orderBy(periodoExpr);
      return rows.map((d) => {
        const [anio, mes] = d.periodo.split("-");
        const ingresos = parseFloat(d.ingresos);
        const costos = parseFloat(d.costos);
        const margen = ingresos - costos;
        return {
          periodo: `${MESES_ES[parseInt(mes, 10) - 1]} ${anio}`,
          ingresos,
          costos,
          margen,
          pctMargen: ingresos > 0 ? margen / ingresos : 0,
        };
      });
    },
  },

  // ─────────────────────────── Reporte de ventas (top productos) ───────────────────────────
  "reportes-ventas": {
    titulo: "Productos más vendidos (30 días)",
    columnas: [
      { header: "Producto", key: "nombre", tipo: "texto", width: 36 },
      { header: "SKU", key: "sku", tipo: "texto", width: 16 },
      { header: "Unidades", key: "cantidad", tipo: "numero", total: true },
      { header: "Total vendido", key: "monto", tipo: "moneda", total: true },
    ],
    async query(ctx) {
      const fechaVentaLocal = sql<string>`(${ventas.fecha} AT TIME ZONE ${ctx.zonaHoraria})::date`;
      const hace30 = new Date();
      hace30.setDate(hace30.getDate() - 30);
      const hace30ISO = hace30.toISOString().slice(0, 10);
      const rows = await db
        .select({
          nombre: productos.nombre,
          sku: productos.sku,
          cantidad: sql<string>`SUM(${ventaDetalle.cantidad})`,
          monto: sql<string>`SUM(${ventaDetalle.subtotal})`,
        })
        .from(ventaDetalle)
        .innerJoin(ventas, eq(ventas.id, ventaDetalle.ventaId))
        .innerJoin(productos, eq(productos.id, ventaDetalle.productoId))
        .where(
          and(
            eq(ventas.empresaId, ctx.user.empresaId),
            eq(ventas.estado, "completada"),
            sql`${fechaVentaLocal} >= ${hace30ISO}`,
            ctx.sucursalIds ? inArray(ventas.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .groupBy(productos.id, productos.nombre, productos.sku)
        .orderBy(sql`SUM(${ventaDetalle.subtotal}) DESC`)
        .limit(TOPE);
      return rows.map((r) => ({
        nombre: r.nombre,
        sku: r.sku,
        cantidad: r.cantidad,
        monto: r.monto,
      }));
    },
  },

  // ─────────────────────────── Configuración: Usuarios ───────────────────────────
  usuarios: {
    titulo: "Usuarios",
    columnas: [
      { header: "Nombre", key: "nombre", tipo: "texto", width: 28 },
      { header: "Correo", key: "email", tipo: "texto", width: 30 },
      { header: "Teléfono", key: "telefono", tipo: "texto", width: 16 },
      { header: "Rol", key: "rol", tipo: "texto", width: 20 },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          nombre: usuarios.nombre,
          email: usuarios.email,
          telefono: usuarios.telefono,
          rol: roles.nombre,
          activo: usuarios.activo,
        })
        .from(usuarios)
        .leftJoin(roles, eq(roles.id, usuarios.rolId))
        .where(and(eq(usuarios.empresaId, ctx.user.empresaId), isNull(usuarios.eliminadoEn)))
        .orderBy(usuarios.nombre)
        .limit(TOPE);
      return rows.map((u) => ({
        nombre: u.nombre,
        email: u.email,
        telefono: u.telefono ?? "",
        rol: u.rol ?? "Sin rol",
        estado: u.activo ? "Activo" : "Inactivo",
      }));
    },
  },

  // ─────────────────────────── Configuración: Sucursales ───────────────────────────
  sucursales: {
    titulo: "Sucursales",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 28 },
      { header: "Dirección", key: "direccion", tipo: "texto", width: 34 },
      { header: "Teléfono", key: "telefono", tipo: "texto", width: 16 },
      { header: "Principal", key: "principal", tipo: "texto", width: 12 },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: sucursales.codigo,
          nombre: sucursales.nombre,
          direccion: sucursales.direccion,
          telefono: sucursales.telefono,
          esPrincipal: sucursales.esPrincipal,
          activa: sucursales.activa,
        })
        .from(sucursales)
        .where(and(eq(sucursales.empresaId, ctx.user.empresaId), isNull(sucursales.eliminadoEn)))
        .orderBy(sucursales.nombre)
        .limit(TOPE);
      return rows.map((s) => ({
        codigo: s.codigo,
        nombre: s.nombre,
        direccion: s.direccion ?? "",
        telefono: s.telefono ?? "",
        principal: s.esPrincipal ? "Sí" : "No",
        estado: s.activa ? "Activa" : "Inactiva",
      }));
    },
  },

  // ─────────────────────────── Configuración: Cajas ───────────────────────────
  cajas: {
    titulo: "Cajas",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 26 },
      { header: "Sucursal", key: "sucursal", tipo: "texto", width: 22 },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: cajas.codigo,
          nombre: cajas.nombre,
          sucursal: sucursales.nombre,
          activa: cajas.activa,
        })
        .from(cajas)
        .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
        .where(
          and(
            eq(cajas.empresaId, ctx.user.empresaId),
            ctx.sucursalIds ? inArray(cajas.sucursalId, ctx.sucursalIds) : undefined,
          ),
        )
        .orderBy(sucursales.nombre, cajas.nombre)
        .limit(TOPE);
      return rows.map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        sucursal: c.sucursal ?? "Sin sucursal",
        estado: c.activa ? "Activa" : "Inactiva",
      }));
    },
  },

  // ─────────────────────────── Configuración: Formas de pago ───────────────────────────
  "formas-pago": {
    titulo: "Formas de pago",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 28 },
      { header: "Requiere referencia", key: "requiereReferencia", tipo: "texto", width: 18 },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: formasPago.codigo,
          nombre: formasPago.nombre,
          requiereReferencia: formasPago.requiereReferencia,
          activa: formasPago.activa,
        })
        .from(formasPago)
        .where(eq(formasPago.empresaId, ctx.user.empresaId))
        .orderBy(formasPago.nombre)
        .limit(TOPE);
      return rows.map((f) => ({
        codigo: f.codigo,
        nombre: f.nombre,
        requiereReferencia: f.requiereReferencia ? "Sí" : "No",
        estado: f.activa ? "Activa" : "Inactiva",
      }));
    },
  },

  // ─────────────────────────── Configuración: Impuestos ───────────────────────────
  impuestos: {
    titulo: "Impuestos",
    columnas: [
      { header: "Código", key: "codigo", tipo: "texto", width: 14 },
      { header: "Nombre", key: "nombre", tipo: "texto", width: 28 },
      { header: "Tasa", key: "tasa", tipo: "porcentaje" },
      { header: "Retención", key: "retencion", tipo: "texto", width: 12 },
      { header: "Estado", key: "estado", tipo: "texto", width: 12 },
    ],
    async query(ctx) {
      const rows = await db
        .select({
          codigo: impuestos.codigo,
          nombre: impuestos.nombre,
          tasa: impuestos.tasa,
          esRetencion: impuestos.esRetencion,
          activo: impuestos.activo,
        })
        .from(impuestos)
        .where(eq(impuestos.empresaId, ctx.user.empresaId))
        .orderBy(impuestos.nombre)
        .limit(TOPE);
      return rows.map((i) => ({
        codigo: i.codigo,
        nombre: i.nombre,
        tasa: i.tasa,
        retencion: i.esRetencion ? "Sí" : "No",
        estado: i.activo ? "Activo" : "Inactivo",
      }));
    },
  },
};

async function queryFacturas(ctx: ExportCtx, esCredito: boolean): Promise<Record<string, unknown>[]> {
  const sp = ctx.params;
  const cond: SQL[] = [eq(facturas.empresaId, ctx.user.empresaId), eq(facturas.esCredito, esCredito)];
  const numero = sp.get("numero");
  if (numero) cond.push(ilike(facturas.numero, `%${numero}%`));
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde))
    cond.push(sql`(${facturas.fecha} AT TIME ZONE ${ctx.zonaHoraria})::date >= ${desde}`);
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta))
    cond.push(sql`(${facturas.fecha} AT TIME ZONE ${ctx.zonaHoraria})::date <= ${hasta}`);
  const vendedor = sp.get("vendedor");
  if (vendedor) cond.push(eq(facturas.vendedorId, vendedor));
  const forma = sp.get("forma");
  if (forma) cond.push(ilike(facturas.formasPago, `%${forma}%`));
  if (ctx.sucursalIds) cond.push(inArray(ventas.sucursalId, ctx.sucursalIds));

  const rows = await db
    .select({
      numero: facturas.numero,
      fecha: facturas.fecha,
      cliente: facturas.clienteNombre,
      vendedor: facturas.vendedorNombre,
      formasPago: facturas.formasPago,
      total: facturas.total,
      sucursal: sucursales.nombre,
      cxcSaldo: cuentasPorCobrar.saldo,
      cxcEstado: cuentasPorCobrar.estado,
      cxcVencimiento: cuentasPorCobrar.fechaVencimiento,
    })
    .from(facturas)
    .leftJoin(ventas, eq(ventas.id, facturas.ventaId))
    .leftJoin(
      cuentasPorCobrar,
      and(eq(cuentasPorCobrar.ventaId, facturas.ventaId), eq(cuentasPorCobrar.empresaId, ctx.user.empresaId)),
    )
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .where(and(...cond))
    .orderBy(desc(facturas.fecha))
    .limit(TOPE);

  return rows.map((f) => ({
    numero: f.numero,
    fecha: f.fecha,
    cliente: f.cliente ?? "Consumidor final",
    sucursal: f.sucursal ?? "Sin sucursal",
    vendedor: f.vendedor ?? "",
    formasPago: f.formasPago ?? "",
    vencimiento: f.cxcVencimiento ?? "",
    saldo: f.cxcSaldo ?? f.total,
    total: f.total,
    estadoCxc: f.cxcEstado ? f.cxcEstado.charAt(0).toUpperCase() + f.cxcEstado.slice(1) : "—",
  }));
}

/**
 * Hojas incluidas en el "libro completo del negocio" (Exportar todo).
 * Orden = orden de las pestañas. Solo recursos sin parámetros obligatorios.
 */
export const HOJAS_NEGOCIO: { recurso: string; hoja: string }[] = [
  { recurso: "ventas", hoja: "Ventas" },
  { recurso: "facturas-credito", hoja: "Facturas al credito" },
  { recurso: "facturas-cobradas", hoja: "Facturas cobradas" },
  { recurso: "inventario", hoja: "Inventario" },
  { recurso: "clientes", hoja: "Clientes" },
  { recurso: "compras", hoja: "Compras" },
  { recurso: "proveedores", hoja: "Proveedores" },
  { recurso: "cxc", hoja: "Cuentas por cobrar" },
  { recurso: "cxp", hoja: "Cuentas por pagar" },
  { recurso: "gastos", hoja: "Gastos" },
  { recurso: "caja", hoja: "Caja" },
  { recurso: "libro-diario", hoja: "Libro Diario" },
  { recurso: "balance-comprobacion", hoja: "Balance de Comprobacion" },
  { recurso: "estado-resultados", hoja: "Estado de Resultados" },
  { recurso: "balance-general", hoja: "Balance General" },
  { recurso: "empleados", hoja: "Empleados" },
  { recurso: "nomina", hoja: "Nomina" },
];
