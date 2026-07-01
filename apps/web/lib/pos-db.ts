/**
 * Cliente IndexedDB del POS (Dexie).
 *
 * Modelo:
 * - `productos`: cache del catálogo (refrescado al abrir POS).
 * - `ventasPendientes`: ventas creadas sin red, pendientes de sync.
 * - `ventasSincronizadas`: histórico de ventas ya sincronizadas (para recibos).
 *
 * Idempotencia: cada VentaPendiente lleva un `uuidLocal` generado en cliente.
 * El servidor usa ese uuid como llave de deduplicación al recibir el batch.
 */

import Dexie, { type Table } from "dexie";

export type ProductoCache = {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  stockDisponible: number;
  updatedAt: number;
};

export type VentaItemLocal = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type VentaPagoLocal = {
  method: string;
  amount: number;
  reference?: string;
};

export type VentaPendiente = {
  uuidLocal: string;
  items: VentaItemLocal[];
  payments: VentaPagoLocal[];
  customerId?: string;
  note?: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type VentaSincronizada = VentaPendiente & {
  saleId: string;
  saleNumber: string;
  syncedAt: number;
};

class POSDb extends Dexie {
  productos!: Table<ProductoCache, string>;
  ventasPendientes!: Table<VentaPendiente, string>;
  ventasSincronizadas!: Table<VentaSincronizada, string>;

  constructor() {
    super("atria_pos");
    this.version(1).stores({
      productos: "id, sku, name, updatedAt",
      ventasPendientes: "uuidLocal, createdAt, attempts",
      ventasSincronizadas: "uuidLocal, saleId, syncedAt",
    });
  }
}

let _db: POSDb | null = null;

export function posDb(): POSDb {
  if (typeof window === "undefined") {
    throw new Error("posDb solo funciona en cliente");
  }
  if (!_db) _db = new POSDb();
  return _db;
}
