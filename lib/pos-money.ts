/** POS settlement uses cents; unit prices, quantities and inventory costs retain their precision. */
export function posMoney(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Importe no válido.");
  const cents = Math.round((value + Math.sign(value) * Number.EPSILON * Math.max(1, Math.abs(value))) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Importe fuera del rango permitido.");
  return cents / 100;
}

export function posLineAmounts(line: {cantidad:number;precioUnitario:number;descuento:number;tasa:number}) {
  const descuento=posMoney(line.descuento);
  const subtotal=posMoney(line.cantidad*line.precioUnitario-descuento);
  const impuesto=posMoney(subtotal*line.tasa);
  return {subtotal,descuento,impuesto,total:posMoney(subtotal+impuesto)};
}

export function posSaleAmounts(lines: Array<{cantidad:number;precioUnitario:number;descuento:number;impuesto:number}>, globalDiscount=0) {
  const sum=(values:number[])=>values.reduce((cents,value)=>cents+Math.round(posMoney(value)*100),0)/100;
  const subtotal=sum(lines.map(line=>posMoney(line.cantidad*line.precioUnitario-posMoney(line.descuento))));
  const impuesto=sum(lines.map(line=>line.impuesto));
  const descuento=posMoney(globalDiscount);
  return {subtotal,impuesto,descuentoTotal:sum([...lines.map(line=>line.descuento),descuento]),total:posMoney(subtotal+impuesto-descuento),ingresoNeto:posMoney(subtotal-descuento)};
}
