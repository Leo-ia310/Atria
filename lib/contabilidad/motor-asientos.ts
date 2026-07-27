/**
 * ⚡ MOTOR CONTABLE — Núcleo del sistema
 *
 * Cada evento de negocio genera su asiento de partida doble automáticamente.
 * El cajero ve "venta → cobrar → ticket". El contador ve el asiento en el libro diario.
 *
 * REGLA FUNDAMENTAL: todo asiento debe cuadrar (total_debe === total_haber) antes
 * de persistir. Si no cuadra, lanzar AsientoNoBalanceadoError sin tocar la DB.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables,
  asientoPartidas,
  catalogoCuentas,
  categoriasGasto,
  cuentasFinancieras,
} from "@/lib/db/schema";
import { CUENTAS_CLAVE } from "@/lib/paises";
import {
  resolverCuentasClave,
  obtenerPeriodoAbierto,
  siguienteNumeroAsiento,
  dinero,
  aDecimalStr,
  type TX,
} from "./helpers";

export {
  PeriodoCerradoError,
  CuentaClaveNoEncontradaError,
} from "./helpers";

export type PartidaAsiento = {
  cuentaId: string;
  descripcion?: string;
  debe: number;
  haber: number;
};

export class AsientoNoBalanceadoError extends Error {
  constructor(public totalDebe: number, public totalHaber: number) {
    super(
      `Asiento desbalanceado: debe=${totalDebe.toFixed(4)}, haber=${totalHaber.toFixed(4)}`,
    );
    this.name = "AsientoNoBalanceadoError";
  }
}

export function validarBalance(partidas: PartidaAsiento[]): void {
  const totalDebe = partidas.reduce((acc, p) => acc + p.debe, 0);
  const totalHaber = partidas.reduce((acc, p) => acc + p.haber, 0);
  if (Math.abs(totalDebe - totalHaber) > 0.0001) {
    throw new AsientoNoBalanceadoError(totalDebe, totalHaber);
  }
}

/**
 * Inserta un asiento completo. Llamar desde dentro de una transacción.
 * Retorna el asientoId creado.
 */
async function crearAsiento(
  tx: TX,
  opciones: {
    empresaId: string;
    fecha: Date;
    concepto: string;
    origen: "venta" | "compra" | "pago_cliente" | "pago_proveedor" | "gasto" | "ajuste_inventario" | "manual" | "cierre_periodo" | "apertura_caja" | "cierre_caja" | "depreciacion" | "nomina";
    referenciaTabla?: string;
    referenciaId?: string;
    partidas: PartidaAsiento[];
    usuarioId: string;
  },
): Promise<string> {
  validarBalance(opciones.partidas);

  const periodoId = await obtenerPeriodoAbierto(tx, opciones.empresaId, opciones.fecha);
  const numero = await siguienteNumeroAsiento(tx, opciones.empresaId, opciones.fecha);

  const totalDebe = opciones.partidas.reduce((a, p) => a + p.debe, 0);
  const totalHaber = opciones.partidas.reduce((a, p) => a + p.haber, 0);

  const [asiento] = await tx
    .insert(asientosContables)
    .values({
      empresaId: opciones.empresaId,
      periodoId,
      numero,
      fecha: opciones.fecha.toISOString().slice(0, 10),
      concepto: opciones.concepto,
      origen: opciones.origen,
      referenciaTabla: opciones.referenciaTabla,
      referenciaId: opciones.referenciaId,
      totalDebe: aDecimalStr(totalDebe),
      totalHaber: aDecimalStr(totalHaber),
      estado: "registrado",
      usuarioId: opciones.usuarioId,
    })
    .returning({ id: asientosContables.id });

  await tx.insert(asientoPartidas).values(
    opciones.partidas.map((p, i) => ({
      asientoId: asiento.id,
      cuentaId: p.cuentaId,
      descripcion: p.descripcion,
      debe: aDecimalStr(p.debe),
      haber: aDecimalStr(p.haber),
      orden: i,
    })),
  );

  return asiento.id;
}

/* =====================================================================
 * 1. VENTA
 * ===================================================================== */

export type RegistrarVentaInput = {
  empresaId: string;
  usuarioId: string;
  ventaId: string;
  fecha: Date;
  numero: string;
  subtotal: number;
  impuesto: number;
  total: number;
  costoTotal: number;
  esCredito: boolean;
  /** Si es contado, qué cuentas financieras y cuánto cobró por cada una */
  pagos?: { cuentaFinancieraId: string; monto: number }[];
};

export async function registrarVenta(input: RegistrarVentaInput): Promise<string> {
  return db.transaction(async (tx) => {
    const cuentas = await resolverCuentasClave(tx, input.empresaId, [
      "VENTAS", "IVA_DEBITO", "CXC_CLIENTES", "COSTO_VENTAS", "INVENTARIO",
    ]);

    const partidas: PartidaAsiento[] = [];

    if (input.esCredito) {
      partidas.push({
        cuentaId: cuentas.CXC_CLIENTES,
        descripcion: `Venta ${input.numero} al crédito`,
        debe: input.total,
        haber: 0,
      });
    } else {
      const pagos = input.pagos ?? [];
      if (pagos.length === 0) {
        throw new Error("Venta de contado requiere al menos un pago");
      }
      const totalPagos = pagos.reduce((a, p) => a + p.monto, 0);
      if (Math.abs(totalPagos - input.total) > 0.0001) {
        throw new Error(
          `Pagos no cubren el total: pagos=${totalPagos}, total=${input.total}`,
        );
      }
      const cuentasFin = await tx
        .select({ id: cuentasFinancieras.id, cuentaContableId: cuentasFinancieras.cuentaContableId })
        .from(cuentasFinancieras)
        .where(eq(cuentasFinancieras.empresaId, input.empresaId));
      const mapaFin = new Map(cuentasFin.map((c) => [c.id, c.cuentaContableId]));
      for (const p of pagos) {
        const cuentaContable = mapaFin.get(p.cuentaFinancieraId);
        if (!cuentaContable) {
          throw new Error(`Cuenta financiera ${p.cuentaFinancieraId} sin cuenta contable`);
        }
        partidas.push({
          cuentaId: cuentaContable,
          descripcion: `Venta ${input.numero}`,
          debe: p.monto,
          haber: 0,
        });
      }
    }

    partidas.push({
      cuentaId: cuentas.VENTAS,
      descripcion: `Ingreso venta ${input.numero}`,
      debe: 0,
      haber: input.subtotal,
    });

    if (input.impuesto > 0) {
      partidas.push({
        cuentaId: cuentas.IVA_DEBITO,
        descripcion: `IVA débito venta ${input.numero}`,
        debe: 0,
        haber: input.impuesto,
      });
    }

    if (input.costoTotal > 0) {
      partidas.push({
        cuentaId: cuentas.COSTO_VENTAS,
        descripcion: `Costo venta ${input.numero}`,
        debe: input.costoTotal,
        haber: 0,
      });
      partidas.push({
        cuentaId: cuentas.INVENTARIO,
        descripcion: `Salida inventario venta ${input.numero}`,
        debe: 0,
        haber: input.costoTotal,
      });
    }

    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto: `Venta ${input.numero}`,
      origen: "venta",
      referenciaTabla: "ventas",
      referenciaId: input.ventaId,
      partidas,
      usuarioId: input.usuarioId,
    });
  });
}

/* =====================================================================
 * 2. COMPRA
 * ===================================================================== */

export type RegistrarCompraInput = {
  empresaId: string;
  usuarioId: string;
  compraId: string;
  fecha: Date;
  numeroFactura?: string | null;
  subtotal: number;
  impuesto: number;
  total: number;
  esCredito: boolean;
  cuentaFinancieraId?: string;
};

export async function registrarCompra(input: RegistrarCompraInput): Promise<string> {
  return db.transaction(async (tx) => {
    const cuentas = await resolverCuentasClave(tx, input.empresaId, [
      "INVENTARIO", "IVA_CREDITO", "CXP_PROVEEDORES",
    ]);

    const ref = input.numeroFactura ?? input.compraId.slice(0, 8);
    const partidas: PartidaAsiento[] = [
      {
        cuentaId: cuentas.INVENTARIO,
        descripcion: `Compra ${ref}`,
        debe: input.subtotal,
        haber: 0,
      },
    ];

    if (input.impuesto > 0) {
      partidas.push({
        cuentaId: cuentas.IVA_CREDITO,
        descripcion: `IVA crédito ${ref}`,
        debe: input.impuesto,
        haber: 0,
      });
    }

    if (input.esCredito) {
      partidas.push({
        cuentaId: cuentas.CXP_PROVEEDORES,
        descripcion: `Compra ${ref} al crédito`,
        debe: 0,
        haber: input.total,
      });
    } else {
      if (!input.cuentaFinancieraId) {
        throw new Error("Compra de contado requiere cuentaFinancieraId");
      }
      const [cf] = await tx
        .select({ cuentaContableId: cuentasFinancieras.cuentaContableId })
        .from(cuentasFinancieras)
        .where(eq(cuentasFinancieras.id, input.cuentaFinancieraId))
        .limit(1);
      if (!cf?.cuentaContableId) {
        throw new Error("Cuenta financiera sin cuenta contable asociada");
      }
      partidas.push({
        cuentaId: cf.cuentaContableId,
        descripcion: `Pago compra ${ref}`,
        debe: 0,
        haber: input.total,
      });
    }

    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto: `Compra ${ref}`,
      origen: "compra",
      referenciaTabla: "compras",
      referenciaId: input.compraId,
      partidas,
      usuarioId: input.usuarioId,
    });
  });
}

/* =====================================================================
 * 3. PAGO A PROVEEDOR
 * ===================================================================== */

export type RegistrarPagoProveedorInput = {
  empresaId: string;
  usuarioId: string;
  pagoId: string;
  cxpId: string;
  fecha: Date;
  monto: number;
  cuentaFinancieraId: string;
  referencia?: string;
};

export async function registrarPagoProveedor(
  input: RegistrarPagoProveedorInput,
  externalTx?: TX,
): Promise<string> {
  const core = async (tx: TX) => {
    const cuentas = await resolverCuentasClave(tx, input.empresaId, [
      "CXP_PROVEEDORES",
    ]);

    const [cf] = await tx
      .select({ cuentaContableId: cuentasFinancieras.cuentaContableId, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(and(eq(cuentasFinancieras.id, input.cuentaFinancieraId), eq(cuentasFinancieras.empresaId, input.empresaId)))
      .limit(1);
    if (!cf?.cuentaContableId) {
      throw new Error("Cuenta financiera sin cuenta contable asociada");
    }

    const concepto = `Pago a proveedor ${input.referencia ?? input.pagoId.slice(0, 8)}`;
    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto,
      origen: "pago_proveedor",
      referenciaTabla: "pagos_proveedor",
      referenciaId: input.pagoId,
      usuarioId: input.usuarioId,
      partidas: [
        {
          cuentaId: cuentas.CXP_PROVEEDORES,
          descripcion: concepto,
          debe: input.monto,
          haber: 0,
        },
        {
          cuentaId: cf.cuentaContableId,
          descripcion: `Salida ${cf.nombre}`,
          debe: 0,
          haber: input.monto,
        },
      ],
    });
  };
  return externalTx ? core(externalTx) : db.transaction(core);
}

/* =====================================================================
 * 4. ABONO DE CLIENTE
 * ===================================================================== */

export type RegistrarAbonoClienteInput = {
  empresaId: string;
  usuarioId: string;
  abonoId: string;
  cxcId: string;
  fecha: Date;
  monto: number;
  cuentaFinancieraId: string;
  referencia?: string;
};

export async function registrarAbonoCliente(
  input: RegistrarAbonoClienteInput,
  externalTx?: TX,
): Promise<string> {
  const core = async (tx: TX) => {
    const cuentas = await resolverCuentasClave(tx, input.empresaId, [
      "CXC_CLIENTES",
    ]);

    const [cf] = await tx
      .select({ cuentaContableId: cuentasFinancieras.cuentaContableId, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(and(eq(cuentasFinancieras.id, input.cuentaFinancieraId), eq(cuentasFinancieras.empresaId, input.empresaId)))
      .limit(1);
    if (!cf?.cuentaContableId) {
      throw new Error("Cuenta financiera sin cuenta contable asociada");
    }

    const concepto = `Abono de cliente ${input.referencia ?? input.abonoId.slice(0, 8)}`;
    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto,
      origen: "pago_cliente",
      referenciaTabla: "abonos_cliente",
      referenciaId: input.abonoId,
      usuarioId: input.usuarioId,
      partidas: [
        {
          cuentaId: cf.cuentaContableId,
          descripcion: `Ingreso ${cf.nombre}`,
          debe: input.monto,
          haber: 0,
        },
        {
          cuentaId: cuentas.CXC_CLIENTES,
          descripcion: concepto,
          debe: 0,
          haber: input.monto,
        },
      ],
    });
  };
  return externalTx ? core(externalTx) : db.transaction(core);
}

/* =====================================================================
 * 5. GASTO
 * ===================================================================== */

export type RegistrarGastoInput = {
  empresaId: string;
  usuarioId: string;
  gastoId: string;
  categoriaGastoId: string;
  cuentaFinancieraId: string;
  fecha: Date;
  descripcion: string;
  subtotal: number;
  impuesto: number;
  total: number;
};

export async function registrarGasto(input: RegistrarGastoInput, externalTx?: TX): Promise<string> {
  const core = async (tx: TX) => {
    const [categoria] = await tx
      .select({ cuentaContableId: categoriasGasto.cuentaContableId, nombre: categoriasGasto.nombre })
      .from(categoriasGasto)
      .where(and(eq(categoriasGasto.id, input.categoriaGastoId), eq(categoriasGasto.empresaId, input.empresaId)))
      .limit(1);
    if (!categoria?.cuentaContableId) {
      throw new Error("Categoría de gasto sin cuenta contable asociada");
    }

    const [cf] = await tx
      .select({ cuentaContableId: cuentasFinancieras.cuentaContableId, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(and(eq(cuentasFinancieras.id, input.cuentaFinancieraId), eq(cuentasFinancieras.empresaId, input.empresaId)))
      .limit(1);
    if (!cf?.cuentaContableId) {
      throw new Error("Cuenta financiera sin cuenta contable asociada");
    }

    const partidas: PartidaAsiento[] = [
      {
        cuentaId: categoria.cuentaContableId,
        descripcion: input.descripcion,
        debe: input.subtotal,
        haber: 0,
      },
    ];

    if (input.impuesto > 0) {
      const cuentas = await resolverCuentasClave(tx, input.empresaId, ["IVA_CREDITO"]);
      partidas.push({
        cuentaId: cuentas.IVA_CREDITO,
        descripcion: `IVA crédito ${input.descripcion}`,
        debe: input.impuesto,
        haber: 0,
      });
    }

    partidas.push({
      cuentaId: cf.cuentaContableId,
      descripcion: `Pago ${cf.nombre}`,
      debe: 0,
      haber: input.total,
    });

    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto: `Gasto: ${input.descripcion}`,
      origen: "gasto",
      referenciaTabla: "gastos",
      referenciaId: input.gastoId,
      partidas,
      usuarioId: input.usuarioId,
    });
  };
  return externalTx ? core(externalTx) : db.transaction(core);
}

/* =====================================================================
 * 6. AJUSTE DE INVENTARIO
 * ===================================================================== */

export type RegistrarAjusteInventarioInput = {
  empresaId: string;
  usuarioId: string;
  movimientoId: string;
  fecha: Date;
  cantidad: number;
  costoUnitario: number;
  esEntrada: boolean;
  motivo: string;
};

export async function registrarAjusteInventario(
  input: RegistrarAjusteInventarioInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    const valor = dinero(input.cantidad * input.costoUnitario);
    const cuentas = await resolverCuentasClave(tx, input.empresaId, [
      "INVENTARIO",
    ]);

    const partidas: PartidaAsiento[] = input.esEntrada
      ? [
          {
            cuentaId: cuentas.INVENTARIO,
            descripcion: `Ajuste entrada: ${input.motivo}`,
            debe: valor,
            haber: 0,
          },
          {
            cuentaId: await cuentaAjustePorDefecto(tx, input.empresaId, true),
            descripcion: `Contrapartida ajuste`,
            debe: 0,
            haber: valor,
          },
        ]
      : [
          {
            cuentaId: await cuentaAjustePorDefecto(tx, input.empresaId, false),
            descripcion: `Ajuste salida (merma): ${input.motivo}`,
            debe: valor,
            haber: 0,
          },
          {
            cuentaId: cuentas.INVENTARIO,
            descripcion: `Salida inventario`,
            debe: 0,
            haber: valor,
          },
        ];

    return crearAsiento(tx, {
      empresaId: input.empresaId,
      fecha: input.fecha,
      concepto: `Ajuste inventario: ${input.motivo}`,
      origen: "ajuste_inventario",
      referenciaTabla: "movimientos_inventario",
      referenciaId: input.movimientoId,
      partidas,
      usuarioId: input.usuarioId,
    });
  });
}

/**
 * Para ajustes de inventario: la contrapartida no está en CUENTAS_CLAVE.
 * Por defecto: entrada → "4201 Ingresos Financieros" (otros ingresos);
 * salida → buscar/crear categoría "Merma" en cuentas de gasto.
 */
async function cuentaAjustePorDefecto(
  tx: TX,
  empresaId: string,
  esEntrada: boolean,
): Promise<string> {
  const codigo = esEntrada ? "4201" : "6201";
  const [cuenta] = await tx
    .select({ id: catalogoCuentas.id })
    .from(catalogoCuentas)
    .where(eq(catalogoCuentas.empresaId, empresaId))
    .limit(1);
  if (!cuenta) throw new Error("Catálogo de cuentas vacío");
  const [encontrada] = await tx
    .select({ id: catalogoCuentas.id })
    .from(catalogoCuentas)
    .where(and(eq(catalogoCuentas.empresaId, empresaId), eq(catalogoCuentas.codigo, codigo)));
  if (!encontrada) {
    throw new Error(`Cuenta de ajuste ${codigo} no encontrada en catálogo`);
  }
  return encontrada.id;
}
