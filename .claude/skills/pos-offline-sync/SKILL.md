---
name: pos-offline-sync
description: Use this skill when building or modifying the POS module in apps/web/app/app/pos/, when implementing IndexedDB storage for offline sales, when designing the sync queue between the Next.js client and the NestJS API, when handling network status detection in the POS, when resolving sync conflicts (duplicate sales, stale prices, deleted products), or when wiring the POS endpoint in apps/api/src/pos/. Triggers on mentions of "POS offline", "IndexedDB", "Dexie", "sync", "modo offline", "cajero sin internet", "cola de sincronización", "service worker", "idempotency", or any work in apps/web/app/app/pos/ or apps/api/src/pos/.
---

# POS offline-first Atria — Patrones de sincronización

El POS de Atria debe **funcionar sin internet** y sincronizarse cuando vuelva la conexión. El internet en comercios LATAM es inestable; perder ventas por una caída de red es inaceptable.

## Arquitectura

```
┌───────────────────────┐         ┌──────────────────────────┐
│  apps/web (Next.js)   │         │  apps/api (NestJS)       │
│  ┌─────────────────┐  │         │  ┌────────────────────┐  │
│  │ POS UI React    │  │  fetch  │  │ POST /api/v1/pos/  │  │
│  └────────┬────────┘  │ ◄─────► │  │  sales/sync        │  │
│           ▼           │         │  └────────────────────┘  │
│  ┌─────────────────┐  │         │           ▼              │
│  │ IndexedDB(Dexie)│  │         │  ┌────────────────────┐  │
│  └─────────────────┘  │         │  │ AccountingService  │  │
└───────────────────────┘         │  │ (journal entries)  │  │
        ▲                          │  └────────────────────┘  │
        │                          │           ▼              │
   Service Worker                  │      PostgreSQL          │
   (cachea catálogo)               └──────────────────────────┘
```

## Librería cliente

Usar **Dexie.js** (`dexie` + `dexie-react-hooks`). API moderna, queries declarativas, tipado fuerte. Agregar a `apps/web/package.json`.

## Schema cliente (IndexedDB)

```ts
// apps/web/lib/pos-db.ts
import Dexie, { type Table } from "dexie";

export type ProductoCache = {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  price: number;
  averageCost: number;
  taxRate: number;
  availableQty: number;
  updatedAt: number;
};

export type VentaPendiente = {
  uuidLocal: string;              // idempotency key, generado en cliente
  organizationId: string;
  branchId: string;
  warehouseId: string;
  cashRegisterSessionId: string;
  membershipId: string;
  customerId?: string;
  items: { productId: string; quantity: number; unitPrice: number; cost: number; tax: number; }[];
  payments: { paymentMethodId: string; amount: number; reference?: string }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  costTotal: number;
  createdAt: number;          // ms epoch
  attempts: number;
  lastError?: string;
  syncedSaleId?: string;      // Sale.id del servidor cuando sincroniza
};

export class POSDb extends Dexie {
  productos!: Table<ProductoCache, string>;
  ventasPendientes!: Table<VentaPendiente, string>;
  ventasSincronizadas!: Table<VentaPendiente, string>;

  constructor() {
    super("atria_pos");
    this.version(1).stores({
      productos: "id, sku, barcode, name",
      ventasPendientes: "uuidLocal, createdAt, attempts",
      ventasSincronizadas: "uuidLocal, syncedSaleId",
    });
  }
}

export const posDb = new POSDb();
```

## Flujo de venta offline

```ts
async function registrarVentaPOS(carrito: Carrito) {
  const uuidLocal = crypto.randomUUID();

  // 1. Guardar EN INDEXEDDB primero (antes de tocar red)
  await posDb.ventasPendientes.add({
    uuidLocal,
    organizationId: session.user.organizationId,
    branchId: cajaActiva.branchId,
    warehouseId: cajaActiva.warehouseId,
    cashRegisterSessionId: cajaActiva.id,
    membershipId: session.user.membershipId,
    customerId: carrito.customerId,
    items: carrito.items,
    payments: carrito.payments,
    subtotal: carrito.subtotal,
    tax: carrito.tax,
    discount: carrito.discount,
    total: carrito.total,
    costTotal: carrito.costTotal,
    createdAt: Date.now(),
    attempts: 0,
  });

  // 2. Decrementar stock optimista en cache
  for (const item of carrito.items) {
    await posDb.productos
      .where("id").equals(item.productId)
      .modify((p) => { p.availableQty -= item.quantity; });
  }

  // 3. Imprimir ticket inmediatamente (no espera red)
  imprimirTicket({ uuidLocal, ...carrito });

  // 4. Disparar sync en background
  void intentarSync();

  return { ok: true, uuidLocal };
}
```

**Nunca esperes la red para confirmar la venta al cajero.** La venta vive en IndexedDB, el ticket sale, el sync es problema del background.

## Endpoint del API — idempotency es la clave

```ts
// apps/api/src/pos/pos.controller.ts
@Post('sales/sync')
@Permissions('pos:sell')
async syncBatch(
  @CurrentUser() user: JwtUser,
  @Body() dto: SyncBatchDto,
): Promise<SyncBatchResult> {
  return this.posService.syncBatch(user, dto.ventas);
}
```

```ts
// apps/api/src/pos/pos.service.ts
async syncBatch(user: JwtUser, ventas: SyncSaleDto[]): Promise<SyncBatchResult> {
  const resultados: SyncResult[] = [];
  for (const v of ventas) {
    try {
      // CRÍTICO: idempotency por uuidLocal
      const existing = await this.prisma.sale.findFirst({
        where: {
          organizationId: user.organizationId,
          idempotencyKey: v.uuidLocal,
        },
        select: { id: true },
      });
      if (existing) {
        resultados.push({ uuidLocal: v.uuidLocal, saleId: existing.id, status: 'already_exists' });
        continue;
      }
      const saleId = await this.procesarVenta(user, v);
      resultados.push({ uuidLocal: v.uuidLocal, saleId, status: 'created' });
    } catch (err) {
      resultados.push({
        uuidLocal: v.uuidLocal,
        status: 'error',
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
  return { resultados };
}
```

**Agregar al modelo `Sale` en Prisma:**
```prisma
model Sale {
  // ...campos existentes
  idempotencyKey  String?  @unique
}
```

## Worker de sync (frontend)

```ts
// apps/web/lib/pos-sync.ts
let syncEnCurso = false;

export async function intentarSync() {
  if (syncEnCurso || !navigator.onLine) return;
  syncEnCurso = true;

  try {
    const pendientes = await posDb.ventasPendientes
      .orderBy("createdAt").limit(20).toArray();
    if (pendientes.length === 0) return;

    const res = await apiClient.post<{ resultados: SyncResult[] }>(
      "/pos/sales/sync",
      { ventas: pendientes },
    );

    await posDb.transaction("rw", posDb.ventasPendientes, posDb.ventasSincronizadas, async () => {
      for (const r of res.resultados) {
        const venta = await posDb.ventasPendientes.get(r.uuidLocal);
        if (!venta) continue;
        if (r.status === 'created' || r.status === 'already_exists') {
          await posDb.ventasSincronizadas.add({ ...venta, syncedSaleId: r.saleId });
          await posDb.ventasPendientes.delete(r.uuidLocal);
        } else {
          await posDb.ventasPendientes.update(r.uuidLocal, {
            attempts: venta.attempts + 1,
            lastError: r.error,
          });
        }
      }
    });
  } finally {
    syncEnCurso = false;
  }
}

// Triggers
if (typeof window !== 'undefined') {
  window.addEventListener("online", () => void intentarSync());
  setInterval(() => void intentarSync(), 30_000);
}
```

## Indicador de conexión en UI

```tsx
function IndicadorConexion() {
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const refresh = async () => setPendientes(await posDb.ventasPendientes.count());
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  if (online && pendientes === 0) return <Badge variant="success">En línea</Badge>;
  if (online && pendientes > 0) return <Badge variant="info">Sincronizando · {pendientes} pendientes</Badge>;
  return <Badge variant="warning">Offline · {pendientes} ventas guardadas</Badge>;
}
```

## Catálogo cacheado

```ts
async function hidratarCatalogo() {
  const ultimo = await posDb.productos.orderBy("updatedAt").last();
  const desde = ultimo?.updatedAt ?? 0;
  const { products } = await apiClient.get<{ products: ProductoCache[] }>(
    `/pos/catalog?since=${desde}`,
  );
  await posDb.productos.bulkPut(products);
}
```

Sync incremental por `updatedAt` para no recargar todo cada vez.

## Service Worker mínimo

`apps/web/public/sw.js`:

```js
const CACHE = "atria-pos-v1";
const SHELL = ["/", "/app/pos", "/_next/static/..."];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api")) return;  // network-only para API
  e.respondWith(caches.match(e.request).then((r) => r ?? fetch(e.request)));
});
```

Registrar en `apps/web/app/app/pos/layout.tsx`:
```tsx
useEffect(() => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
}, []);
```

## Manejo de conflictos

| Conflicto | Política |
|---|---|
| Misma venta enviada 2 veces | Idempotency por `uuidLocal` — la segunda devuelve `already_exists` con el `saleId` original. |
| Producto vendido fue eliminado en servidor | Aceptar la venta (era válido al venderse). El asiento se genera con `unitCost` del cache. |
| Precio cambió entre cache y servidor | Respetar el precio del momento de venta. El servidor NO recalcula. |
| Stock negativo después de sync | Aceptar la venta, registrar alerta en `AuditLog`. Operación humana resuelve. |
| Sesión de caja cerrada en servidor | Rechazar venta. Cajero debe re-abrir caja. |

**Regla:** el cliente es la fuente de verdad de la venta una vez impreso el ticket. El servidor concilia, no corrige.

## Checklist al implementar el POS

- [ ] `apps/web/lib/pos-db.ts` con Dexie + schema versionado
- [ ] Venta guarda en IndexedDB ANTES de cualquier fetch al API
- [ ] Ticket se imprime sin depender del API
- [ ] Modelo Prisma `Sale` tiene `idempotencyKey String? @unique`
- [ ] `POST /api/v1/pos/sales/sync` valida idempotency por `uuidLocal`
- [ ] Worker de sync corre cada 30s + en evento `online`
- [ ] Indicador de conexión visible en el header del POS
- [ ] Catálogo se hidrata al abrir POS, refresh incremental por `updatedAt`
- [ ] Service worker registrado para shell offline
- [ ] Pruebas: vender con red apagada → re-conectar → verificar sync
- [ ] Pruebas: enviar la misma venta dos veces → segunda recibe `already_exists`
