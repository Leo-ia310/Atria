import {sql} from "drizzle-orm";
import {facturas} from "./db/schema";
export function facturaTieneSaldo(){return sql<boolean>`exists(select 1 from cuentas_por_cobrar c where c.empresa_id=${facturas.empresaId} and c.venta_id=${facturas.ventaId} and c.saldo>0 and c.estado not in ('anulada','cancelada'))`;}
