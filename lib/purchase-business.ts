import {safeErrorMessage} from "@/lib/database-error";
import { normalizeSupplierDocument } from "./supplier-document-identity";
import { fechaMediodiaUTC } from "@/lib/dates";

import { businessEntityId, businessChildId } from "@/lib/business-context";

import type { z } from "zod";

import { revalidateBusinessPath as revalidatePath } from "@/lib/business-action";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { and, eq, isNull, sql } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  compras,
  compraDetalle,
  cuentasPorPagar,
  almacenes,
  proveedores,
} from "@/lib/db/schema";
import { procesarCompraSchema } from "@/lib/validations/compras";
import { requireSession } from "@/lib/actions/session-helpers";
import { registrarCompra } from "@/lib/contabilidad/motor-asientos";
import {
  siguienteNumero,
  dinero,
  aDecimalStr,
} from "@/lib/contabilidad/helpers";
import { getPoliticasNegocio } from "@/lib/politicas-negocio";

export type Resultado =
  | { ok: true; compraId: string; asientoId: string }
  | { ok: false; error: string };

import { applyPurchaseInventory } from "./purchase-inventory";
export async function procesarCompraBusiness(
  data: z.output<typeof procesarCompraSchema>,
  user: Awaited<ReturnType<typeof requireSession>>,
  document?: {
    ordenId: string;
    accountingDebits: Array<{ cuentaId: string; monto: number }>;
    fechaVencimiento?: string;
    lineAmounts?: number[];
  },
): Promise<Resultado> {
  if (!document && data.numeroFactura?.trim()) {
    const number = normalizeSupplierDocument(data.numeroFactura);
    const duplicate = await dbConEmpresa(user.empresaId, async (tx) => {
      const [schema] = await tx.execute(
        sql`select to_regclass('public.abast_facturas') as registry`,
      );
      if (!schema.registry) return false; // Compatible when the optional procurement migration is not installed yet.
      const [row] = await tx.execute(
        sql`select id from abast_facturas where empresa_id=${user.empresaId}::uuid and proveedor_id=${data.proveedorId}::uuid and doc_key::jsonb->>1=${number} limit 1`,
      );
      return Boolean(row);
    });
    if (duplicate)
      return {
        ok: false,
        error:
          "Este documento del proveedor ya está registrado en Abastecimiento. Recupera su compra/CxP original; no se creará otra.",
      };
  }
  if (!data.esCredito && !data.cuentaFinancieraId) {
    return { ok: false, error: "Compra de contado requiere cuenta financiera" };
  }

  const [almacen] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({ id: almacenes.id, sucursalId: almacenes.sucursalId })
      .from(almacenes)
      .where(
        and(
          eq(almacenes.id, data.almacenId),
          eq(almacenes.empresaId, user.empresaId),
          eq(almacenes.activo, true),
        ),
      )
      .limit(1),
  );
  if (!almacen) {
    return { ok: false, error: "Almacen no valido para esta empresa" };
  }

  const subtotal = dinero(
    ...(document?.lineAmounts ??
      data.items.map((i) => dinero(i.cantidad * i.costoUnitario))),
  );
  const impuesto = dinero(...data.items.map((i) => i.impuesto));
  const total = dinero(subtotal + impuesto);
  let diasCreditoCompra = data.esCredito ? data.diasCredito : 0;

  if (data.esCredito && diasCreditoCompra <= 0) {
    const [proveedor] = await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .select({ dias: proveedores.diasCredito })
        .from(proveedores)
        .where(
          and(
            eq(proveedores.id, data.proveedorId),
            eq(proveedores.empresaId, user.empresaId),
            isNull(proveedores.eliminadoEn),
          ),
        )
        .limit(1),
    );
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };
    const politicas = await getPoliticasNegocio(user.empresaId);
    diasCreditoCompra =
      proveedor.dias > 0
        ? proveedor.dias
        : politicas.diasCreditoProveedorDefault;
  }

  try {
    const fecha = fechaMediodiaUTC(data.fecha);
    const fechaVencimiento = document?.fechaVencimiento
      ? fechaMediodiaUTC(document.fechaVencimiento)
      : data.esCredito
        ? new Date(fecha.getTime() + diasCreditoCompra * 24 * 3600 * 1000)
        : null;

    const compraResult = await dbConEmpresa(user.empresaId, async (tx) => {
      const numeroAuto = await siguienteNumero(tx, {
        empresaId: user.empresaId,
        prefijo: "C",
        fecha,
        tabla: compras as never,
        columnaNumero: compras.numeroFactura as never,
      });
      void numeroAuto;

      const [compra] = await tx
        .insert(compras)
        .values({
          id: businessEntityId("compra"),
          empresaId: user.empresaId,
          sucursalId: almacen.sucursalId,
          almacenId: data.almacenId,
          proveedorId: data.proveedorId,
          ordenId: document?.ordenId,
          flujo: document ? "documental" : "simultanea",
          numeroFactura: data.numeroFactura || null,
          fecha: data.fecha,
          estado: "recibida",
          esCredito: data.esCredito,
          diasCredito: diasCreditoCompra,
          fechaVencimiento:
            fechaVencimiento?.toISOString().slice(0, 10) ?? null,
          subtotal: aDecimalStr(subtotal),
          impuesto: aDecimalStr(impuesto),
          total: aDecimalStr(total),
          notas: data.notas || null,
          usuarioId: user.id,
        })
        .returning({ id: compras.id });

      await tx.insert(compraDetalle).values(
        data.items.map((it, index) => ({
          compraId: compra.id,
          productoId: it.productoId,
          cantidad: aDecimalStr(it.cantidad),
          costoUnitario: aDecimalStr(it.costoUnitario),
          impuesto: aDecimalStr(it.impuesto),
          subtotal: aDecimalStr(
            document?.lineAmounts?.[index] ??
              dinero(it.cantidad * it.costoUnitario),
          ),
        })),
      );

      if (!document)
        await applyPurchaseInventory(tx, {
          empresaId: user.empresaId,
          usuarioId: user.id,
          almacenId: data.almacenId,
          referenciaTabla: "compras",
          referenciaId: compra.id,
          items: data.items,
        });

      if (data.esCredito) {
        await tx.insert(cuentasPorPagar).values({
          id: businessChildId("cuentas_por_pagar", 0),
          empresaId: user.empresaId,
          proveedorId: data.proveedorId,
          compraId: compra.id,
          fechaEmision: data.fecha,
          fechaVencimiento: fechaVencimiento!.toISOString().slice(0, 10),
          monto: aDecimalStr(total),
          saldo: aDecimalStr(total),
          estado: "pendiente",
        });
      }

      return compra;
    });

    const asientoId = await registrarCompra({
      empresaId: user.empresaId,
      usuarioId: user.id,
      compraId: compraResult.id,
      fecha,
      numeroFactura: data.numeroFactura ?? null,
      subtotal,
      impuesto,
      total,
      baseDebits: document?.accountingDebits,
      esCredito: data.esCredito,
      sucursalId: almacen.sucursalId,
      cuentaFinancieraId: data.cuentaFinancieraId || undefined,
    });

    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(compras)
        .set({ asientoId })
        .where(
          and(
            eq(compras.id, compraResult.id),
            eq(compras.empresaId, user.empresaId),
          ),
        ),
    );

    revalidatePath("/compras");
    revalidatePath("/inventario");
    await invalidarModulos(user.empresaId, [
      MODULOS.REPORTES,
      MODULOS.CONTABILIDAD,
    ]);

    return { ok: true, compraId: compraResult.id, asientoId };
  } catch (err) {
    console.error("[procesarCompra]", err);
    const msg = safeErrorMessage(err,"No se pudo guardar la operación. Reintenta el mismo intento.");
    return { ok: false, error: `No pudimos procesar la compra: ${msg}` };
  }
}
