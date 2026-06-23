---
name: motor-contable-atria
description: Use this skill when implementing or modifying any function in lib/contabilidad/motor-asientos.ts, when adding accounting logic to a server action that touches money or inventory (ventas, compras, pagos, abonos, gastos, ajustes), when designing the journal entry (partida doble) for a new business event, when wiring CUENTAS_CLAVE lookups, or when validating that an asiento balances. Triggers on mentions of "asiento contable", "partida doble", "libro diario", "debe/haber", "motor contable", "balance", "CxC", "CxP", "IVA", "costo de ventas", "período contable", or any task that creates rows in asientos_contables/asiento_partidas.
---

# Motor contable ATRIA — Guía de implementación

Esta skill codifica las reglas innegociables del motor de partida doble de ATRIA. Léela completa antes de tocar `lib/contabilidad/motor-asientos.ts` o cualquier server action que afecte dinero o inventario.

## Regla fundamental

**Todo evento de negocio que toque dinero o stock genera un asiento contable.** Sin atajos. Si una operación se cuela sin asiento, está mal.

```
debe === haber  (tolerancia ±0.0001)
```

Si no cuadra → `throw new AsientoNoBalanceadoError(totalDebe, totalHaber)` antes de tocar la DB.

## Flujo obligatorio de toda función del motor

```ts
export async function registrarX(input) {
  // 1. Resolver cuentas por CUENTAS_CLAVE (nunca hardcodear códigos)
  const cuentas = await resolverCuentasClave(empresaId, ["VENTAS", "IVA_DEBITO", ...]);

  // 2. Validar período abierto
  await validarPeriodoAbierto(empresaId, input.fecha);  // tira PeriodoCerradoError

  // 3. Construir partidas
  const partidas: PartidaAsiento[] = [
    { cuentaCodigo: "CAJA", debe: total, haber: 0, descripcion: "..." },
    { cuentaCodigo: "VENTAS", debe: 0, haber: subtotal, descripcion: "..." },
    { cuentaCodigo: "IVA_DEBITO", debe: 0, haber: impuesto, descripcion: "..." },
  ];

  // 4. Validar balance
  validarBalance(partidas);  // tira AsientoNoBalanceadoError si no cuadra

  // 5. Insertar en transacción atómica
  return db.transaction(async (tx) => {
    const numero = await siguienteNumeroAsiento(tx, empresaId, fecha);
    const [asiento] = await tx.insert(asientosContables).values({
      empresaId,
      periodoId,
      numero,
      fecha,
      concepto: "Venta #" + input.numero,
      origen: "venta",
      referenciaTabla: "ventas",
      referenciaId: input.ventaId,
      totalDebe,
      totalHaber,
      estado: "registrado",
      usuarioId,
    }).returning();

    await tx.insert(asientoPartidas).values(
      partidas.map((p, i) => ({
        asientoId: asiento.id,
        cuentaId: cuentas[p.cuentaCodigo],
        descripcion: p.descripcion,
        debe: p.debe.toString(),
        haber: p.haber.toString(),
        orden: i,
      })),
    );

    return asiento.id;
  });
}
```

## Plantillas de asientos por evento

### 1. Venta de contado
```
DEBE   Caja (CAJA)              total
HABER  Ventas (VENTAS)          subtotal
HABER  IVA Débito (IVA_DEBITO)  impuesto
+ COSTO:
DEBE   Costo de Ventas (COSTO_VENTAS)   costoTotal
HABER  Inventario (INVENTARIO)          costoTotal
```

### 2. Venta al crédito (fiado)
```
DEBE   CxC Clientes (CXC_CLIENTES)  total
HABER  Ventas (VENTAS)              subtotal
HABER  IVA Débito (IVA_DEBITO)      impuesto
+ COSTO (igual que contado)
```
Además: crear fila en `cuentas_por_cobrar` con `saldo = monto`.

### 3. Venta con pago mixto (efectivo + tarjeta)
Una línea DEBE por cada forma de pago, en lugar de un solo DEBE en Caja. Total de DEBES de pagos = total de la venta.

### 4. Compra de contado
```
DEBE   Inventario (INVENTARIO)        subtotal
DEBE   IVA Crédito (IVA_CREDITO)      impuesto
HABER  Caja (CAJA)                    total
```
Actualizar costo promedio del producto si `metodo_costeo = "promedio"`:
```
nuevoCosto = (stockAnterior * costoAnterior + cantidad * costoUnitario)
             / (stockAnterior + cantidad)
```

### 5. Compra al crédito
```
DEBE   Inventario (INVENTARIO)        subtotal
DEBE   IVA Crédito (IVA_CREDITO)      impuesto
HABER  CxP Proveedores (CXP_PROVEEDORES)   total
```
Crear fila en `cuentas_por_pagar`.

### 6. Pago a proveedor
```
DEBE   CxP Proveedores (CXP_PROVEEDORES)   monto
HABER  Caja|Banco                          monto
```
Reducir saldo de la CxP. Si llega a 0 → `estado = "pagada"`.

### 7. Abono de cliente
```
DEBE   Caja|Banco              monto
HABER  CxC Clientes (CXC_CLIENTES)   monto
```
Reducir saldo de la CxC.

### 8. Gasto operativo
```
DEBE   Cuenta de Gasto (de categorías_gasto)   subtotal
DEBE   IVA Crédito (IVA_CREDITO)               impuesto
HABER  Caja|Banco                              total
```

### 9. Ajuste de inventario (entrada)
```
DEBE   Inventario (INVENTARIO)                cantidad * costo
HABER  Otros Ingresos / Ajuste                cantidad * costo
```

### 10. Ajuste de inventario (salida / merma)
```
DEBE   Gasto - Merma                          cantidad * costo
HABER  Inventario (INVENTARIO)                cantidad * costo
```

### 11. Cierre de período (al cerrar mes)
Saldos de cuentas de resultado (ingresos, costos, gastos) se trasladan a `3103 Utilidad del Ejercicio`. Después: `UPDATE periodos_contables SET estado='cerrado', cerrado_en=now()`.

## Resolución de CUENTAS_CLAVE

Nunca hardcodes `"1101"` en código de negocio. Resuelve a través del mapa por empresa:

```ts
async function resolverCuentasClave(
  empresaId: string,
  claves: (keyof typeof CUENTAS_CLAVE)[],
): Promise<Record<string, string>> {
  // 1. Leer override desde configuraciones (clave="cuentas_clave")
  const [conf] = await db
    .select({ valor: configuraciones.valor })
    .from(configuraciones)
    .where(and(
      eq(configuraciones.empresaId, empresaId),
      eq(configuraciones.clave, "cuentas_clave"),
    ));

  const mapeo = (conf?.valor as Record<string, string>) ?? CUENTAS_CLAVE;

  // 2. Buscar cuenta_id por código
  const codigos = claves.map((k) => mapeo[k]);
  const cuentas = await db
    .select({ id: catalogoCuentas.id, codigo: catalogoCuentas.codigo })
    .from(catalogoCuentas)
    .where(and(
      eq(catalogoCuentas.empresaId, empresaId),
      inArray(catalogoCuentas.codigo, codigos),
    ));

  return Object.fromEntries(
    claves.map((k) => {
      const codigo = mapeo[k];
      const c = cuentas.find((x) => x.codigo === codigo);
      if (!c) throw new Error(`Cuenta clave no encontrada: ${k} (${codigo})`);
      return [k, c.id];
    }),
  );
}
```

## Numeración de asientos

Formato: `AS-YYYY-NNNNNN` (ej. `AS-2026-000123`). Numeración correlativa por empresa y año, no por mes.

```ts
async function siguienteNumeroAsiento(
  tx: Transaction,
  empresaId: string,
  fecha: Date,
): Promise<string> {
  const anio = fecha.getFullYear();
  const prefijo = `AS-${anio}-`;
  const [ultimo] = await tx
    .select({ numero: asientosContables.numero })
    .from(asientosContables)
    .where(and(
      eq(asientosContables.empresaId, empresaId),
      like(asientosContables.numero, `${prefijo}%`),
    ))
    .orderBy(desc(asientosContables.numero))
    .limit(1);

  const siguiente = ultimo
    ? parseInt(ultimo.numero.split("-").pop()!, 10) + 1
    : 1;
  return prefijo + String(siguiente).padStart(6, "0");
}
```

## Anulación de asientos

**Nunca UPDATE/DELETE en `asiento_partidas`.** Para anular:

1. Marcar el asiento original como `estado='anulado'`, llenar `anulado_en` y `motivo_anulacion`.
2. Crear un **asiento contrario** con los mismos montos pero debe↔haber invertidos.
3. Concepto del contrario: `"Anulación AS-2026-000123: <motivo>"`.
4. La venta/compra/etc. original se marca como `anulada`.

## Reportes financieros — NO los persistas

Libro Mayor, Balance de Comprobación, Estado de Resultados y Balance General son **queries** sobre `asiento_partidas`, no tablas. Nunca caches saldos en columnas.

```sql
-- Saldo de una cuenta a una fecha
SELECT
  SUM(debe) - SUM(haber) AS saldo_deudor,
  SUM(haber) - SUM(debe) AS saldo_acreedor
FROM asiento_partidas p
JOIN asientos_contables a ON a.id = p.asiento_id
WHERE p.cuenta_id = $1
  AND a.empresa_id = $2
  AND a.fecha <= $3
  AND a.estado = 'registrado';
```

La naturaleza (deudora/acreedora) de la cuenta determina cuál saldo mostrar.

## Errores tipados

```ts
AsientoNoBalanceadoError  // partidas no cuadran
PeriodoCerradoError       // fecha cae en período cerrado
CuentaClaveNoEncontradaError  // mapeo CUENTAS_CLAVE roto
StockInsuficienteError    // venta sin inventario
```

Todos exportados desde `lib/contabilidad/motor-asientos.ts`. El UI los captura y muestra mensaje en español al cajero.

## Checklist antes de declarar terminada una función del motor

- [ ] La función valida que el período esté abierto antes de insertar
- [ ] La función llama a `validarBalance(partidas)` antes del INSERT
- [ ] Las cuentas se resuelven por `CUENTAS_CLAVE` (no hardcodeadas)
- [ ] El INSERT es atómico (`db.transaction`)
- [ ] El asiento queda con `referencia_tabla` y `referencia_id` apuntando a la entidad de negocio
- [ ] La entidad de negocio (venta/compra/etc.) guarda el `asiento_id` retornado
- [ ] Si hay movimiento de inventario, se inserta en `movimientos_inventario` APPEND-ONLY en la misma transacción
- [ ] Test manual: el balance de comprobación cuadra después de ejecutar
