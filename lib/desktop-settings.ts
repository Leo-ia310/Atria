import { and,eq,sql } from "drizzle-orm";
import {clientes} from "./db/schema";
import { z } from "zod";
import type { Tx } from "./db";
import type { SessionUser } from "./actions/session-helpers";
import * as actions from "./actions/configuracion";
import { crearCaja } from "./actions/caja";
import { crearPeriodo, cerrarPeriodo, reabrirPeriodo } from "./actions/periodos";
import { resolverTransferencia } from "./actions/transferencias";
import * as productActions from "./actions/productos";
import * as inventoryAi from "./actions/inventario-ia";
import { actualizarCliente } from "./actions/clientes";
import { currentBusinessContext } from "./business-context";
import { crearCuentaFinanciera as crearCuentaTesoreria, crearGasto, actualizarGastoRecurrente } from "./actions/tesoreria";
export class DesktopSettingsRejected extends Error {}

/** Adapt identifiers and scope; all mutations use the existing web services. */
export async function executeDesktopSettings(tx:Tx,user:SessionUser,branches:string[],payload:Record<string,unknown>) {
  const action=z.string().parse(payload.action);
  const args=z.array(z.unknown()).max(3).parse(payload.args);
  const id=()=>z.string().uuid().parse(args[0]);
  const input=()=>z.record(z.unknown()).parse(args[0]);
  async function owned(table:"usuarios"|"roles"|"formas_pago"|"productos"|"clientes",recordId:string) {
    const rows=await tx.execute(sql`select id from ${sql.identifier(table)} where id=${recordId}::uuid and empresa_id=${user.empresaId}::uuid`);
    if(!rows.length)throw new DesktopSettingsRejected("El registro no pertenece a esta empresa.");
  }
  async function role(value:unknown) {await owned("roles",z.string().uuid().parse(value));}
  async function account(value:unknown,scope=branches) {
    if(!value)return;
    const rows=await tx.execute(sql`select id from cuentas_financieras where id=${z.string().uuid().parse(value)}::uuid and empresa_id=${user.empresaId}::uuid and activa=true and (sucursal_id is null or sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(scope)}::jsonb)::uuid)))`);
    if(!rows.length)throw new DesktopSettingsRejected("Cuenta financiera no autorizada para este dispositivo.");
  }
  switch(action) {
    case "crearProducto":return productActions.crearProducto(input());
    case "actualizarProducto":await owned("productos",id());return productActions.actualizarProducto(id(),args[1]);
    case "actualizarCliente":{
      await owned("clientes",id());const [current]=await tx.select().from(clientes).where(and(eq(clientes.id,id()),eq(clientes.empresaId,user.empresaId)));
      return actualizarCliente(id(),{...current,identificacionFiscal:current.identificacionFiscal??"",email:current.email??"",telefono:current.telefono??"",direccion:current.direccion??"",notas:current.notas??"",...z.record(z.unknown()).parse(args[1])});
    }
    case "crearMarca":return productActions.crearMarca(input());
    case "crearCategoria":return productActions.crearCategoria(input());
    case "interpretarProductoTexto":return inventoryAi.interpretarProductoTexto(input());
    case "supervisarImportacionIA":return inventoryAi.supervisarImportacionIA(input());
    case "importarProductosInventario":
    case "registrarCompraRapidaInventarioPorLector":
    case "crearProductosDesdeAsistente": {
      const value=input();const scope=currentBusinessContext()?.sucursalIds??branches;
      if(value.almacenId){const warehouses=await tx.execute(sql`select id from almacenes where id=${z.string().uuid().parse(value.almacenId)}::uuid and empresa_id=${user.empresaId}::uuid and activo=true and sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(scope)}::jsonb)::uuid))`);if(!warehouses.length)throw new DesktopSettingsRejected("Almacén no autorizado para esta operación.");}
      if(action==="importarProductosInventario")return productActions.importarProductosInventario(value);
      if(action==="crearProductosDesdeAsistente")return inventoryAi.crearProductosDesdeAsistente(value);
      return productActions.registrarCompraRapidaInventarioPorLector(value);
    }
    case "resolverTransferencia":return resolverTransferencia(input());
    case "crearPeriodo":return crearPeriodo(input());
    case "cerrarPeriodo":return cerrarPeriodo(input());
    case "reabrirPeriodo":return reabrirPeriodo(input());
    case "crearGastoTesoreria":
    case "actualizarGastoRecurrente": {
      const value=input();const scope=currentBusinessContext()?.sucursalIds??branches;await account(value.cuentaFinancieraId,scope);
      if(action==="crearGastoTesoreria"&&scope.length!==1)throw new DesktopSettingsRejected("Selecciona una sucursal para registrar el gasto.");
      const categories=await tx.execute(sql`select id from categorias_gasto where id=${z.string().uuid().parse(value.categoriaId)}::uuid and empresa_id=${user.empresaId}::uuid and activa=true`);
      if(!categories.length)throw new DesktopSettingsRejected("Categoría de gasto no autorizada.");
      if(action==="actualizarGastoRecurrente") {
        const rows=await tx.execute(sql`select id from gastos_recurrentes where id=${z.string().uuid().parse(value.id)}::uuid and empresa_id=${user.empresaId}::uuid and (sucursal_id is null or sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(scope)}::jsonb)::uuid)))`);
        if(!rows.length)throw new DesktopSettingsRejected("Gasto recurrente no autorizado.");
        return actualizarGastoRecurrente(value);
      }
      return crearGasto(value);
    }
    case "crearCuentaTesoreria": {
      const value=input();
      if(value.cuentaContableId){
        const rows=await tx.execute(sql`select id from catalogo_cuentas where id=${z.string().uuid().parse(value.cuentaContableId)}::uuid and empresa_id=${user.empresaId}::uuid and activa=true and permite_movimiento=true`);
        if(!rows.length)throw new DesktopSettingsRejected("Cuenta contable no autorizada para esta empresa.");
      }
      return crearCuentaTesoreria(value);
    }
    case "crearSucursal": return actions.crearSucursal(input());
    case "crearUsuario": await role(input().rolId);return actions.crearUsuario(input());
    case "actualizarUsuario": {
      await owned("usuarios",id());const values=z.record(z.unknown()).parse(args[1]);await role(values.rolId);
      return actions.actualizarUsuario(id(),values);
    }
    case "crearRol": return actions.crearRol(input());
    case "actualizarPermisosRol": {
      await role(id());const ids=z.array(z.string().uuid()).max(1000).parse(args[1]);
      const rows=ids.length?await tx.execute(sql`select id from permisos where id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid))`):[];
      if(rows.length!==new Set(ids).size)throw new DesktopSettingsRejected("La lista de permisos no es válida.");
      return actions.actualizarPermisosRol(id(),ids);
    }
    case "crearCuentaFinanciera": return actions.crearCuentaFinanciera(input());
    case "crearSecuenciaFiscal": return actions.crearSecuenciaFiscal(input());
    case "crearFormaPago": await account(input().cuentaFinancieraId);return actions.crearFormaPago(input());
    case "actualizarFormaPago": {
      await owned("formas_pago",id());const values=z.record(z.unknown()).parse(args[1]);await account(values.cuentaFinancieraId);
      return actions.actualizarFormaPago(id(),values);
    }
    case "eliminarFormaPago": await owned("formas_pago",id());return actions.eliminarFormaPago(id());
    case "crearImpuesto": return actions.crearImpuesto(input());
    case "actualizarPoliticasNegocio": return actions.actualizarPoliticasNegocio(input());
    case "actualizarConfiguracionNegocio": return actions.actualizarConfiguracionNegocio(input());
    case "crearCaja": {
      if(!branches.includes(String(input().sucursalId)))throw new DesktopSettingsRejected("Sucursal no autorizada.");
      return crearCaja(input());
    }
    default: throw new DesktopSettingsRejected("Acción de configuración no compatible.");
  }
}
