/**
 * Worker de sync del POS.
 *
 * Patrón:
 * 1. Las ventas se guardan en IndexedDB ANTES de tocar la red.
 * 2. El ticket se imprime de inmediato (no espera al servidor).
 * 3. Este worker procesa la cola en background: al recuperar conexión,
 *    cada 30s, o al disparo manual.
 * 4. El servidor recibe `uuidLocal` y deduplica por idempotencia.
 *
 * NOTA: el endpoint `/pos/checkout-batch` aún no existe en el API. Mientras
 * tanto, sincronizamos venta por venta vía `/pos/checkout`. El servidor
 * actualmente no implementa idempotencia explícita por `uuidLocal` — esto
 * se documenta como pendiente en la skill `pos-offline-sync`.
 */

import { apiClient, ApiError, ApiDisabledError } from "./api-client";
import { posDb, type VentaPendiente } from "./pos-db";

let syncEnCurso = false;
const listeners = new Set<() => void>();

export function onSyncChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb();
}

export async function contarPendientes(): Promise<number> {
  if (typeof window === "undefined") return 0;
  return posDb().ventasPendientes.count();
}

export async function intentarSync(): Promise<{ ok: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine || syncEnCurso) {
    return { ok: 0, failed: 0 };
  }
  syncEnCurso = true;
  emit();

  let ok = 0;
  let failed = 0;
  try {
    const pendientes = await posDb()
      .ventasPendientes.orderBy("createdAt")
      .limit(20)
      .toArray();
    if (pendientes.length === 0) return { ok: 0, failed: 0 };

    for (const venta of pendientes) {
      try {
        const res = await apiClient.post<{ sale: { id: string; number: string } }>(
          "/pos/checkout",
          {
            items: venta.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              discount: it.discount,
            })),
            payments: venta.payments,
            customerId: venta.customerId,
            note: venta.note
              ? `${venta.note} [sync:${venta.uuidLocal.slice(0, 8)}]`
              : `[sync:${venta.uuidLocal.slice(0, 8)}]`,
          },
        );
        await posDb().transaction(
          "rw",
          posDb().ventasPendientes,
          posDb().ventasSincronizadas,
          async () => {
            await posDb().ventasSincronizadas.add({
              ...venta,
              saleId: res.sale.id,
              saleNumber: res.sale.number,
              syncedAt: Date.now(),
            });
            await posDb().ventasPendientes.delete(venta.uuidLocal);
          },
        );
        ok += 1;
      } catch (err) {
        if (err instanceof ApiDisabledError) {
          // No tiene sentido seguir intentando; rompemos el loop.
          failed += pendientes.length - ok;
          break;
        }
        const message = err instanceof ApiError ? err.message : "Error desconocido";
        await posDb().ventasPendientes.update(venta.uuidLocal, {
          attempts: venta.attempts + 1,
          lastError: message,
        });
        failed += 1;
      }
    }
  } finally {
    syncEnCurso = false;
    emit();
  }
  return { ok, failed };
}

export async function encolarVenta(venta: Omit<VentaPendiente, "attempts">): Promise<void> {
  await posDb().ventasPendientes.add({ ...venta, attempts: 0 });
  emit();
  void intentarSync();
}

let intervaloRegistrado = false;

export function registrarSyncBackground() {
  if (typeof window === "undefined" || intervaloRegistrado) return;
  intervaloRegistrado = true;
  window.addEventListener("online", () => void intentarSync());
  setInterval(() => void intentarSync(), 30_000);
}
