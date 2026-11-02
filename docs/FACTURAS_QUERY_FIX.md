# Corrección de la excepción al abrir Facturas

El filtro añadido para excluir documentos pendientes de cobradas usaba
`c.estado NOT IN ('anulada','cancelada')`. Ninguno de esos estados existe en el
enum PostgreSQL `cxc_estado`; la consulta falla con 22P02 incluso sin datos que
coincidan. Afectaba la portada, la lista/impresión de cobradas y Excel.

`facturaTieneSaldo` ahora usa las columnas Drizzle del esquema y saldo positivo,
sin valores de enum ajenos a cuentas por cobrar. Una deuda vencida o incobrable
no equivale a dinero recibido. Se conserva la correlación por empresa y venta.
Excel reutiliza el mismo filtro y la portada usa una consulta compartida con su
prueba, dentro del contexto de empresa.

`npm run test:facturas` crea PostgreSQL temporal, sin leer .env ni datos reales.
Reproduce 22P02 y ejecuta las consultas reales de resumen y Excel con efectivo,
transferencia pendiente, crédito, deuda vencida/incobrable y saldo cero. Comprueba
aislamiento de empresas, sucursales y selección vacía. No requiere migración.
