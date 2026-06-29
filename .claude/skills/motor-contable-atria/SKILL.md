---
name: motor-contable-atria
description: Use this skill when implementing or modifying any logic in apps/api/src/accounting/ (AccountingService, controllers, DTOs), when adding accounting side-effects to any other service that touches money or inventory (sales, purchases, payments, expenses, adjustments), when designing the journal entry (partida doble) for a new business event, when wiring Account lookups by code, or when validating that a JournalEntry balances. Triggers on mentions of "asiento contable", "partida doble", "libro diario", "debe/haber", "JournalEntry", "JournalEntryLine", "Account", "CxC", "CxP", "IVA", "costo de ventas", "período contable", "Receivable", "Payable", or any task that creates rows in JournalEntry/JournalEntryLine.
---

# Motor contable Atria — Guía de implementación

Esta skill codifica las reglas innegociables del motor de partida doble. **Léela completa antes de modificar `apps/api/src/accounting/`** o cualquier service que afecte dinero o inventario.

## Regla fundamental

**Todo evento de negocio que toque dinero o stock genera un `JournalEntry` con sus `JournalEntryLine`.** Sin atajos.

```
Σ debit === Σ credit  (tolerancia ±0.0001)
```

Si no cuadra → `throw new BadRequestException('Asiento desbalanceado: ...')` ANTES de tocar la DB.

## Modelo de datos (Prisma)

```prisma
model JournalEntry {
  id                String              @id @default(uuid())
  organizationId    String
  periodId          String?
  number            String              // formato AS-YYYY-NNNNNN
  date              DateTime
  description       String
  origin            String              // 'sale' | 'purchase' | 'payment_received' | ...
  referenceTable    String?
  referenceId       String?
  totalDebit        Decimal
  totalCredit       Decimal
  status            String              // 'posted' | 'voided'
  createdByUserId   String?
  lines             JournalEntryLine[]
}

model JournalEntryLine {
  id              String   @id @default(uuid())
  journalEntryId  String
  accountId       String
  description     String?
  debit           Decimal  @default(0)
  credit          Decimal  @default(0)
  order           Int      @default(0)
}

model Account {
  id              String   @id
  organizationId  String
  code            String   // "1101", "4101", etc.
  name            String
  type            String   // 'asset' | 'liability' | 'equity' | 'income' | 'cost' | 'expense'
  nature          String   // 'debit' | 'credit'
  parentId        String?
  isDetail        Boolean  // si true, permite movimientos
}
```

## Flujo obligatorio de toda operación contable

```ts
// apps/api/src/accounting/accounting.service.ts
async crearAsientoVenta(input: VentaInput, tx?: Prisma.TransactionClient) {
  const db = tx ?? this.prisma;

  // 1. Resolver cuentas por código canónico (NUNCA hardcodear "1101")
  const cuentas = await this.resolverCuentasClave(input.organizationId, [
    'CASH', 'BANK', 'AR_CUSTOMERS', 'SALES', 'VAT_PAYABLE',
    'COST_OF_SALES', 'INVENTORY',
  ], db);

  // 2. Validar período abierto
  const period = await this.obtenerPeriodoAbierto(input.organizationId, input.date, db);

  // 3. Construir líneas
  const lines: PartidaInput[] = [];
  if (input.isCredit) {
    lines.push({ accountId: cuentas.AR_CUSTOMERS, debit: input.total, credit: 0 });
  } else {
    for (const p of input.payments) {
      const cuentaFin = await this.cuentaContableDeFormaPago(p.paymentMethodId, db);
      lines.push({ accountId: cuentaFin, debit: p.amount, credit: 0 });
    }
  }
  lines.push({ accountId: cuentas.SALES, debit: 0, credit: input.subtotal });
  if (input.tax > 0) {
    lines.push({ accountId: cuentas.VAT_PAYABLE, debit: 0, credit: input.tax });
  }
  if (input.costTotal > 0) {
    lines.push({ accountId: cuentas.COST_OF_SALES, debit: input.costTotal, credit: 0 });
    lines.push({ accountId: cuentas.INVENTORY, debit: 0, credit: input.costTotal });
  }

  // 4. Validar balance
  this.validarBalance(lines);  // throw BadRequestException si no cuadra

  // 5. Insertar
  const number = await this.siguienteNumeroAsiento(input.organizationId, input.date, db);
  return db.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      periodId: period.id,
      number,
      date: input.date,
      description: `Venta ${input.saleNumber}`,
      origin: 'sale',
      referenceTable: 'Sale',
      referenceId: input.saleId,
      totalDebit: lines.reduce((a, l) => a + Number(l.debit), 0),
      totalCredit: lines.reduce((a, l) => a + Number(l.credit), 0),
      status: 'posted',
      createdByUserId: input.userId,
      lines: { create: lines.map((l, i) => ({ ...l, order: i })) },
    },
  });
}
```

**El service de Sales/Purchases/Payments/Expenses DEBE pasar su transacción Prisma al motor para que TODO ocurra en una sola transacción atómica.**

## Plantillas de asientos por evento

### Venta de contado
```
DEBIT   Cash/Bank (por cada pago)    Σ = total
CREDIT  Sales                        subtotal
CREDIT  VAT Payable                  tax
+
DEBIT   Cost of Sales                costTotal
CREDIT  Inventory                    costTotal
```

### Venta a crédito (fiado)
```
DEBIT   Accounts Receivable          total
CREDIT  Sales                        subtotal
CREDIT  VAT Payable                  tax
+ (igual bloque de costo)
```
Además: `Receivable.create({ saleId, organizationId, amount: total, outstandingAmount: total, status: 'PENDING', dueDate: ... })`.

### Compra de contado
```
DEBIT   Inventory                    subtotal
DEBIT   VAT Receivable               tax
CREDIT  Cash/Bank                    total
```
Y actualizar `Product.averageCost` con costo promedio ponderado.

### Compra a crédito
```
DEBIT   Inventory                    subtotal
DEBIT   VAT Receivable               tax
CREDIT  Accounts Payable             total
```
+ `Payable.create({...})`.

### Pago a proveedor
```
DEBIT   Accounts Payable             amount
CREDIT  Cash/Bank                    amount
```
Reducir `Payable.outstandingAmount`. Si llega a 0 → status PAID.

### Abono de cliente
```
DEBIT   Cash/Bank                    amount
CREDIT  Accounts Receivable          amount
```

### Gasto
```
DEBIT   Expense Account              subtotal
DEBIT   VAT Receivable               tax
CREDIT  Cash/Bank                    total
```

### Ajuste de inventario (entrada/merma)
- **Entrada**: `DEBIT Inventory`, `CREDIT Other Income` (o cuenta de ajuste)
- **Merma**: `DEBIT Expense - Shrinkage`, `CREDIT Inventory`

## Códigos clave (CUENTAS_CLAVE)

**No hardcodes códigos** en código de negocio. Mapea claves canónicas:

```ts
const CUENTAS_CLAVE = {
  CASH: '1101',
  PETTY_CASH: '1102',
  BANK: '1103',
  AR_CUSTOMERS: '1104',
  INVENTORY: '1105',
  VAT_RECEIVABLE: '1106',
  AP_SUPPLIERS: '2101',
  VAT_PAYABLE: '2102',
  WITHHOLDINGS: '2103',
  SALES: '4101',
  SALES_RETURNS: '4102',
  SALES_DISCOUNTS: '4103',
  COST_OF_SALES: '5101',
} as const;
```

Si una organización **renombra/recodifica** una cuenta, el mapeo debe vivir en `CompanySetting` con key `accounting.account_codes`. La función `resolverCuentasClave` lo lee como override.

## Numeración de asientos

Formato: `AS-YYYY-NNNNNN` (ej. `AS-2026-000123`). Correlativo por `organizationId` y año.

```ts
async siguienteNumeroAsiento(organizationId: string, date: Date, tx: Prisma.TransactionClient) {
  const year = date.getFullYear();
  const prefix = `AS-${year}-`;
  const last = await tx.journalEntry.findFirst({
    where: { organizationId, number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const next = last ? parseInt(last.number.split('-').pop()!, 10) + 1 : 1;
  return prefix + String(next).padStart(6, '0');
}
```

## Anulación

**Nunca UPDATE/DELETE en `JournalEntryLine`.** Para anular:

1. `JournalEntry.update({ status: 'voided', voidedAt: now, voidReason })`
2. Crear `JournalEntry` contrario con `debit`/`credit` invertidos y `origin: 'reversal'`.
3. La entidad de negocio (Sale/Purchase/etc.) se marca con `status: 'voided'`.

## Reportes financieros — NO los persistas

Libro Mayor, Balance de Comprobación, Estado de Resultados y Balance General son **queries** sobre `JournalEntryLine`. Nunca caches saldos en columnas — recalcúlalos al vuelo.

```sql
-- Saldo de una cuenta a una fecha
SELECT
  SUM(line.debit) AS total_debit,
  SUM(line.credit) AS total_credit
FROM journal_entry_line line
JOIN journal_entry entry ON entry.id = line.journal_entry_id
WHERE line.account_id = $1
  AND entry.organization_id = $2
  AND entry.date <= $3
  AND entry.status = 'posted';
```

## Errores tipados

```ts
new BadRequestException({ code: 'UNBALANCED_ENTRY', message: 'Asiento desbalanceado: ...' })
new BadRequestException({ code: 'PERIOD_CLOSED', message: 'Período cerrado' })
new BadRequestException({ code: 'ACCOUNT_KEY_NOT_FOUND', message: 'Cuenta CASH no mapeada' })
new BadRequestException({ code: 'INSUFFICIENT_STOCK', message: '...' })
```

## Checklist antes de declarar terminada una operación contable

- [ ] El service llama al motor contable dentro de su transacción Prisma
- [ ] La función valida período abierto antes de insertar
- [ ] La función valida `Σ debit === Σ credit` (con tolerancia ±0.0001)
- [ ] Las cuentas se resuelven por código canónico (no hardcodeadas)
- [ ] El `JournalEntry` tiene `referenceTable` + `referenceId` apuntando a la entidad de negocio
- [ ] La entidad de negocio guarda el `journalEntryId` retornado
- [ ] Si hay movimiento de inventario, se inserta `StockMovement` APPEND-ONLY en la misma transacción
- [ ] El test unitario verifica balance + side effects
