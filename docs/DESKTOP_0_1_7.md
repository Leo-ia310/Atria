# ARCA Desktop 0.1.7 — entrega coordinada

Desktop mantiene SQLite local para operar sin internet y sincroniza comandos
idempotentes con los mismos servicios de negocio de la web. Cloud sigue siendo
la fuente central. Esta entrega no incluye Restaurante en Desktop.

## Despliegue web

El despliegue existente de Vercel ejecuta pre-migrate, db:migrate y build. Las
migraciones nuevas deben completarse antes de distribuir el instalador:

- 0024: evidencia de efectivo/tarjeta manual sin fabricar aprobación histórica.
- 0025: transferencias pendientes con RLS y referencia bancaria única por cuenta.
- 0026: estado fiscal pendiente en comprobantes internos anteriores.

El preparador Desktop versión 10 instala/actualiza infraestructura de dispositivos,
recibos idempotentes, cambios incrementales, alcance y políticas. No se deben dar
credenciales de PostgreSQL ni secretos de proveedores a los clientes Desktop.

Login y pull incluyen permisos/plan/sucursales autorizados. Push usa el usuario y
dispositivo autenticados para resolver empresa; aplica ventas, pagos, movimientos
y contabilidad en una transacción con el recibo idempotente. Los comandos de
gestión que necesitan el servidor se bloquean sin conexión.

## Pagos y fiscalidad

Tarjeta manual exige datáfono independiente, aprobación y autorización declaradas.
Transferencia pendiente requiere cliente: crea saldo por cobrar y una intención
separada, sin sumar fondos al banco. Tesorería verifica o rechaza online con
referencia, alcance y versión; confirmar reutiliza registrarAbono y rechazar
mantiene la deuda. Facturas no considera cobrado un documento con saldo abierto.

Los comprobantes Desktop permanecen internos, con fiscal_status=pending_submission,
fiscal_provider_status=not_configured y sin identificador oficial, incluso tras
sincronizar. La impresión informa esta condición. No existe todavía un proveedor
integrado para transmitirlos ni se afirma aceptación fiscal.

## Validación de entrega

Build Next.js y pruebas de rutas/compliance. PostgreSQL aislado con servicios reales:
1.000 operaciones, doble push, stock aditivo de dos equipos, pagos sin duplicar,
permisos, conflictos, rollback, RRHH y delta. El recorrido HTTP/Electron usa dos bases
independientes; ventas -2/-3, cliente, cola recuperada y ambas cachés convergen.

Desktop añade cifrado completo de SQLite con clave protegida por Windows y
migración conservando datos. Se probaron archivo cifrado, clave ajena/faltante,
reapertura en procesos separados, terminación abrupta y WAL. El ASAR final recorre
19 ventanas, 11 apartados y exportación XLSX; se verifica el logo morado.

Las pruebas usan este equipo Windows y bases temporales. No sustituyen dos PCs,
impresora/datáfono físicos o pruebas de aceptación con una autoridad/proveedor fiscal.
El instalador 0.1.7 se genera localmente; no se incluye en Git.
