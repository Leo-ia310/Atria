# Corrección del cobro POS: 52,99 frente a 52,992

El modal redondeaba a dos decimales, pero el servicio conservaba cuatro decimales
en impuestos y totales. Un subtotal 46,08 con impuesto 6,912 mostraba/cobraba 52,99,
mientras contabilidad validaba 52,992 y rechazaba el asiento. La tolerancia anterior
del servicio permitía pasar esa diferencia hasta una comprobación contable más estricta.

La regla compartida `lib/pos-money.ts` redondea los importes de cada línea antes de
sumarlos. El formulario, el payload validado, la venta, el pago y el comprobante
usan centavos. Precio unitario, cantidades y costo conservan su precisión para
productos fraccionarios e inventario. No se relaja el balance contable ni se
aceptan pagos con un centavo faltante. El descuento global también se descuenta
del ingreso enviado a contabilidad para mantener el asiento balanceado.

Pruebas:

- `npm run test:pos`: caso 52,992 → 52,99, redondeo por línea, medios centavos,
  mixto, descuento global, conservación de precisión y rechazo de pago incompleto.
  Se ejecuta automáticamente con `prebuild` antes de cada compilación/despliegue.
- `npm run test:desktop:sync`: PostgreSQL temporal ejecuta directamente la acción
  web `procesarVenta`, sin adaptador Desktop, y comprueba venta, factura, pagos y
  asiento balanceado para efectivo, mixto, descuento y cantidad fraccionaria.
  El rechazo de un centavo faltante conserva ventas, pagos y stock.
- Las pruebas de sincronización y SQLite offline se mantienen como regresión del
  servicio/regla compartidos. No se usan credenciales ni datos de producción.

No requiere migración de datos. Después del despliegue hay que recargar el POS
para obtener el cálculo actualizado del formulario.
