---
name: pos-offline-sync
description: Use this skill when building or modifying the POS (Punto de Venta) module, when implementing IndexedDB storage for offline sales, when designing the sync queue between client and server, when handling network status detection in the POS, when resolving sync conflicts (duplicate sales, stale prices, deleted products), or when wiring the /api/pos/sync endpoint. Triggers on mentions of "POS offline", "IndexedDB", "sync", "modo offline", "cajero sin internet", "cola de sincronización", "service worker", "pendiente_sync", or any work in app/(app)/pos/ or app/api/pos/sync/.
---

# POS offline-first ATRIA — Patrones de sincronización

El POS de ATRIA debe **funcionar sin internet** y sincronizarse cuando vuelva la conexión. El internet en comercios LATAM es inestable; perder ventas por una caída de red es inaceptable.

## Arquitectura

```
┌─────────────────────┐         ┌─────────────────────┐
│  POS (browser)      │         │  Servidor           │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │  UI React     │  │  fetch  │  │ /api/pos/sync │  │
│  └──────┬────────┘  │ ◄─────► │  └───────────────┘  │
│         ▼           │         │         ▼           │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │  IndexedDB    │  │         │  │  PostgreSQL   │  │
│  │  (Dexie)      │  │         │  │  (Drizzle)    │  │
│  └───────────────┘  │         │  └───────────────┘  │
└─────────────────────┘         └─────────────────────┘
        ▲                              motor-asientos
        │
   Service Worker
   (cachea catálogo + precios)
```

## Decisión clave: librería

Usar **Dexie.js** (`dexie`) sobre IndexedDB raw. Tipado fuerte, API moderna, queries declarativas. Agrega `dexie` y `dexie-react-hooks` a `package.json`.

## Schema cliente (IndexedDB)

```ts
// lib/pos/db-client.ts
import Dexie, { type Table } from "dexie";

export type ProductoCache = {
  id: string;
  sku: string;
  codigoBarras?: string;
  nombre: string;
  precio: number;
  costoPromedio: number;
  impuestoTasa: number;
  stockDisponible: number;
  categoriaId?: string;
  actualizadoEn: number;
};

export type VentaPendiente = {
  uuidLocal: string;              // generado en cliente, idempotency key
  empresaId: string;
  sucursalId: string;
  sesionCajaId: string;
  usuarioId: string;
  clienteId?: string;
  items: VentaItemPendiente[];
  pagos: VentaPagoPendiente[];
  subtotal: number;
  impuesto: number;
  descuento: number;
  total: number;
  fechaCreacion: number;          // ms epoch
  intentos: number;
  ultimoError?: string;
  syncedId?: string;              // venta.id del servidor cuando sincroniza
};

export class POSDb extends Dexie {
  productos!: Table<ProductoCache, string>;
  ventasPendientes!: Table<VentaPendiente, string>;
  ventasSincronizadas!: Table<VentaSincronizada, string>;

  constructor() {
    super("atria_pos");
    this.version(1).stores({
      productos: "id, sku, codigoBarras, nombre, categoriaId",
      ventasPendientes: "uuidLocal, fechaCreacion, intentos",
      ventasSincronizadas: "syncedId, fechaCreacion",
    });
  }
}

export const posDb = new POSDb();
```

## Flujo de venta offline

```ts
async function registrarVentaPOS(carrito: Carrito) {
  // 1. Generar uuidLocal (idempotency key)
  const uuidLocal = crypto.randomUUID();

  // 2. Guardar EN INDEXEDDB primero (antes de intentar red)
  await posDb.ventasPendientes.add({
    uuidLocal,
    empresaId: session.empresaId,
    sucursalId: session.sucursalId,
    ...carrito,
    fechaCreacion: Date.now(),
    intentos: 0,
  });

  // 3. Decrementar stock optimista en cache local
  for (const item of carrito.items) {
    await posDb.productos
      .where("id").equals(item.productoId)
      .modify((p) => { p.stockDisponible -= item.cantidad; });
  }

  // 4. Imprimir ticket (datos locales — no espera red)
  imprimirTicket({ uuidLocal, ...carrito });

  // 5. Disparar sync en background (no bloquea UI)
  void intentarSync();

  return { ok: true, uuidLocal };
}
```

**Nunca esperes la red para confirmar la venta al cajero.** La venta vive en IndexedDB y el ticket sale. El sync ocurre en background.

## Endpoint de sync — idempotency es la clave

```ts
// app/api/pos/sync/route.ts
export async function POST(req: Request) {
  const user = await requireSession();
  const body = await req.json();
  const parsed = ventasBatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "..." }, { status: 400 });

  const resultados = [];
  for (const venta of parsed.data.ventas) {
    try {
      // CRÍTICO: idempotency por uuidLocal
      const existente = await db
        .select({ id: ventas.id })
        .from(ventas)
        .where(and(
          eq(ventas.empresaId, user.empresaId),
          eq(ventas.numero, venta.uuidLocal),  // o columna idempotency_key
        ))
        .limit(1);

      if (existente.length > 0) {
        resultados.push({ uuidLocal: venta.uuidLocal, syncedId: existente[0].id, status: "ya_existe" });
        continue;
      }

      // Procesar venta: genera asiento via motor-asientos.registrarVenta()
      const ventaId = await procesarVentaServidor(venta, user);
      resultados.push({ uuidLocal: venta.uuidLocal, syncedId: ventaId, status: "creada" });
    } catch (err) {
      resultados.push({ uuidLocal: venta.uuidLocal, status: "error", error: String(err) });
    }
  }

  return Response.json({ ok: true, resultados });
}
```

Agregar columna a `ventas`:
```ts
idempotencyKey: text("idempotency_key").unique(),  // = uuidLocal del cliente
```

## Worker de sync

```ts
// lib/pos/sync-worker.ts
let syncEnCurso = false;

export async function intentarSync() {
  if (syncEnCurso) return;
  if (!navigator.onLine) return;
  syncEnCurso = true;

  try {
    const pendientes = await posDb.ventasPendientes
      .orderBy("fechaCreacion")
      .limit(20)
      .toArray();

    if (pendientes.length === 0) return;

    const res = await fetch("/api/pos/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ventas: pendientes }),
    });

    if (!res.ok) throw new Error("sync_failed");
    const { resultados } = await res.json();

    await posDb.transaction("rw", posDb.ventasPendientes, posDb.ventasSincronizadas, async () => {
      for (const r of resultados) {
        if (r.status === "creada" || r.status === "ya_existe") {
          const venta = await posDb.ventasPendientes.get(r.uuidLocal);
          if (venta) {
            await posDb.ventasSincronizadas.add({ ...venta, syncedId: r.syncedId });
            await posDb.ventasPendientes.delete(r.uuidLocal);
          }
        } else {
          await posDb.ventasPendientes.update(r.uuidLocal, {
            intentos: (await posDb.ventasPendientes.get(r.uuidLocal))!.intentos + 1,
            ultimoError: r.error,
          });
        }
      }
    });
  } finally {
    syncEnCurso = false;
  }
}

// Disparar sync en eventos:
window.addEventListener("online", () => void intentarSync());
setInterval(() => void intentarSync(), 30_000);  // cada 30s
```

## Detección de estado de conexión

```tsx
function IndicadorConexion() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
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

  if (online && pendientes === 0) {
    return <Badge variant="success">En línea</Badge>;
  }
  if (online && pendientes > 0) {
    return <Badge variant="info">Sincronizando · {pendientes} pendientes</Badge>;
  }
  return <Badge variant="warning">Modo offline · {pendientes} ventas guardadas</Badge>;
}
```

## Catálogo cacheado

Al iniciar el POS, hidrata `productos` desde el servidor:

```ts
async function hidratarCatalogo(empresaId: string) {
  const ultimaActualizacion = await posDb.productos
    .orderBy("actualizadoEn").last();
  const desde = ultimaActualizacion?.actualizadoEn ?? 0;

  const res = await fetch(`/api/pos/catalogo?desde=${desde}`);
  const { productos: nuevos } = await res.json();

  await posDb.productos.bulkPut(nuevos);
}
```

Sincronización incremental por `actualizado_en` para no recargar todo cada vez.

## Service Worker (mínimo)

`public/sw.js` cacheando el shell de la app:

```js
const CACHE = "atria-pos-v1";
const SHELL = ["/", "/pos", "/_next/static/..."];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api/")) return;  // network-only para API
  e.respondWith(
    caches.match(e.request).then((r) => r ?? fetch(e.request)),
  );
});
```

Registrar en `app/(app)/pos/layout.tsx`:
```tsx
useEffect(() => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
}, []);
```

## Manejo de conflictos

| Conflicto | Política |
|---|---|
| Misma venta enviada 2 veces | Idempotency por `uuidLocal` — la segunda devuelve `ya_existe` con el `syncedId` original. |
| Producto vendido fue eliminado en servidor | Aceptar la venta (era válido cuando se vendió). El asiento se genera con `costoUnitario` del cache. |
| Precio cambió entre cache y servidor | Respetar el precio del momento de venta (lo que el cajero cobró). El servidor NO recalcula. |
| Stock negativo después de sync | Aceptar la venta, registrar alerta en `auditoria`. Operación humana resuelve. |
| Sesión de caja cerrada en servidor | Rechazar venta. Cajero debe re-abrir caja. |

**Regla:** el cliente es la fuente de verdad de la venta una vez impreso el ticket. El servidor concilia, no corrige.

## Checklist al implementar el POS

- [ ] `posDb` (Dexie) inicializado con schema versionado
- [ ] Venta guarda en IndexedDB ANTES de cualquier fetch
- [ ] Ticket se imprime sin depender de respuesta del servidor
- [ ] `idempotencyKey` columna en `ventas`, índice único
- [ ] Worker de sync corre cada 30s + en evento `online`
- [ ] Indicador de conexión visible siempre en el header del POS
- [ ] Catálogo se hidrata al abrir POS, refresh incremental por `actualizado_en`
- [ ] Service worker registrado para el shell
- [ ] Pruebas: vender con red apagada, prender red, verificar sync
- [ ] Pruebas: re-enviar la misma venta dos veces, verificar idempotencia
