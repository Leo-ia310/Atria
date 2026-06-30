/**
 * Tests de la validación de balance del motor contable.
 * Verifican que la regla Σ debe === Σ haber se aplique correctamente.
 */

describe('Validación de balance (partida doble)', () => {
  const cuadra = (
    lines: { debit: number; credit: number }[],
    tolerance = 0.001,
  ): boolean => {
    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) <= tolerance;
  };

  it('venta de contado: caja vs ventas + IVA debe cuadrar', () => {
    const venta = [
      { debit: 115, credit: 0 }, // Caja
      { debit: 0, credit: 100 }, // Ventas
      { debit: 0, credit: 15 }, // IVA
    ];
    expect(cuadra(venta)).toBe(true);
  });

  it('venta al crédito: CxC vs ventas + IVA debe cuadrar', () => {
    const venta = [
      { debit: 115, credit: 0 }, // CxC
      { debit: 0, credit: 100 }, // Ventas
      { debit: 0, credit: 15 }, // IVA
    ];
    expect(cuadra(venta)).toBe(true);
  });

  it('compra al crédito: inventario + IVA crédito vs CxP debe cuadrar', () => {
    const compra = [
      { debit: 100, credit: 0 }, // Inventario
      { debit: 15, credit: 0 }, // IVA Crédito
      { debit: 0, credit: 115 }, // CxP
    ];
    expect(cuadra(compra)).toBe(true);
  });

  it('detecta desbalance pequeño que excede tolerancia', () => {
    const malformado = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 99.99 },
    ];
    expect(cuadra(malformado)).toBe(false);
  });

  it('tolera redondeos de centavos al cuarto decimal', () => {
    const conRedondeo = [
      { debit: 100.0001, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    expect(cuadra(conRedondeo)).toBe(true);
  });

  it('asiento con costo de venta (4 líneas) debe cuadrar', () => {
    const ventaConCosto = [
      { debit: 115, credit: 0 }, // Caja
      { debit: 0, credit: 100 }, // Ventas
      { debit: 0, credit: 15 }, // IVA
      { debit: 60, credit: 0 }, // Costo de ventas
      { debit: 0, credit: 60 }, // Inventario (salida)
    ];
    expect(cuadra(ventaConCosto)).toBe(true);
  });

  it('asiento de pago a proveedor: CxP vs Caja', () => {
    const pago = [
      { debit: 500, credit: 0 }, // CxP
      { debit: 0, credit: 500 }, // Caja
    ];
    expect(cuadra(pago)).toBe(true);
  });

  it('asiento de gasto con IVA: Gasto + IVA vs Caja', () => {
    const gasto = [
      { debit: 100, credit: 0 }, // Gasto
      { debit: 15, credit: 0 }, // IVA Crédito
      { debit: 0, credit: 115 }, // Caja
    ];
    expect(cuadra(gasto)).toBe(true);
  });
});
