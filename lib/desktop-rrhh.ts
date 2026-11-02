import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "./db";
import type { SessionUser } from "./actions/session-helpers";
import * as actions from "./actions/rrhh";

export class DesktopRrhhRejected extends Error {}

/** A transport allowlist; validation and payroll calculations stay in web services. */
export async function executeDesktopRrhh(tx: Tx, user: SessionUser, branches: string[], payload: Record<string,unknown>) {
  const action = z.string().parse(payload.action);
  const args = z.array(z.unknown()).max(3).parse(payload.args);
  const id = () => z.string().uuid().parse(args[0]);
  const input = () => z.record(z.unknown()).parse(args[0]);
  async function employee(employeeId: unknown) {
    const rows = await tx.execute(sql`select sucursal_id from empleados where id=${z.string().uuid().parse(employeeId)}::uuid and empresa_id=${user.empresaId}::uuid and eliminado_en is null`);
    if (!rows.length || rows[0].sucursal_id && !branches.includes(String(rows[0].sucursal_id))) throw new DesktopRrhhRejected("Empleado no disponible para este dispositivo.");
  }
  async function payroll(nominaId: string) {
    const rows = await tx.execute(sql`select id from nominas where id=${nominaId}::uuid and empresa_id=${user.empresaId}::uuid`);
    const denied = await tx.execute(sql`select d.id from nomina_detalles d join empleados e on e.id=d.empleado_id where d.nomina_id=${nominaId}::uuid and (e.empresa_id!=${user.empresaId}::uuid or (e.sucursal_id is not null and not (e.sucursal_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(branches)}::jsonb)::uuid))))) limit 1`);
    if (!rows.length || denied.length) throw new DesktopRrhhRejected("Nómina no disponible para este dispositivo.");
  }
  async function detail(detailId: unknown) {
    const rows = await tx.execute(sql`select nomina_id from nomina_detalles where id=${z.string().uuid().parse(detailId)}::uuid and empresa_id=${user.empresaId}::uuid`);
    if (!rows.length) throw new DesktopRrhhRejected("Detalle de nómina no disponible.");
    await payroll(String(rows[0].nomina_id));
  }
  async function variable(table: "nomina_ingresos"|"nomina_deducciones", variableId: string) {
    const rows = await tx.execute(sql`select nomina_detalle_id from ${sql.identifier(table)} where id=${variableId}::uuid and empresa_id=${user.empresaId}::uuid`);
    if (!rows.length) throw new DesktopRrhhRejected("Registro de nómina no disponible.");
    await detail(rows[0].nomina_detalle_id);
  }
  switch(action) {
    case "crearFeriado": return actions.crearFeriado(input());
    case "sembrarFeriados": return actions.sembrarFeriados(z.number().int().min(1900).max(2200).parse(args[0]));
    case "actualizarFeriado": case "eliminarFeriado": {
      const rows=await tx.execute(sql`select id from feriados where id=${id()}::uuid and empresa_id=${user.empresaId}::uuid`);
      if(!rows.length)throw new DesktopRrhhRejected("Feriado no disponible para esta empresa.");
      return action==="actualizarFeriado"?actions.actualizarFeriado(id(),z.record(z.unknown()).parse(args[1])):actions.eliminarFeriado(id());
    }
    case "crearEmpleado": case "actualizarEmpleado": {
      const values = z.record(z.unknown()).parse(action==="crearEmpleado" ? args[0] : args[1]);
      if (values.sucursalId && !branches.includes(String(values.sucursalId))) throw new DesktopRrhhRejected("Sucursal no autorizada.");
      if(action==="actualizarEmpleado") { await employee(id()); return actions.actualizarEmpleado(id(),values); }
      return actions.crearEmpleado(values);
    }
    case "cambiarEstadoEmpleado": await employee(id()); return actions.cambiarEstadoEmpleado(id(),z.enum(["activo","vacaciones","licencia","suspendido","baja"]).parse(args[1]));
    case "registrarAsistencia": await employee(input().empleadoId); return actions.registrarAsistencia(input());
    case "crearSolicitud": await employee(input().empleadoId); return actions.crearSolicitud(input());
    case "resolverSolicitud": {
      const rows=await tx.execute(sql`select empleado_id from solicitudes_rrhh where id=${id()}::uuid and empresa_id=${user.empresaId}::uuid`);
      if(!rows.length) throw new DesktopRrhhRejected("Solicitud no disponible."); await employee(rows[0].empleado_id);
      return actions.resolverSolicitud(id(),z.boolean().parse(args[1]),z.string().max(500).optional().parse(args[2]));
    }
    case "generarNomina": {
      const denied=await tx.execute(sql`select id from sucursales where empresa_id=${user.empresaId}::uuid and activa=true and eliminado_en is null and not(id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(branches)}::jsonb)::uuid))) limit 1`);
      if(denied.length) throw new DesktopRrhhRejected("Generar nómina requiere acceso a todas las sucursales.");
      return actions.generarNomina(input());
    }
    case "verificarNomina": await payroll(id()); return actions.verificarNomina(id());
    case "eliminarNominaBorrador": await payroll(id()); return actions.eliminarNominaBorrador(id());
    case "pagarDetalleNomina": await detail(id()); return actions.pagarDetalleNomina(id(),z.boolean().parse(args[1]));
    case "finalizarPagoNomina": await payroll(id()); return actions.finalizarPagoNomina(id(),z.string().uuid().parse(args[1]));
    case "crearTipoIngreso": return actions.crearTipoIngreso(input());
    case "crearTipoDeduccion": return actions.crearTipoDeduccion(input());
    case "agregarIngresoVariable": await detail(input().nominaDetalleId); return actions.agregarIngresoVariable(input());
    case "agregarDeduccionVariable": await detail(input().nominaDetalleId); return actions.agregarDeduccionVariable(input());
    case "eliminarIngresoVariable": await variable("nomina_ingresos",id()); return actions.eliminarIngresoVariable(id());
    case "eliminarDeduccionVariable": await variable("nomina_deducciones",id()); return actions.eliminarDeduccionVariable(id());
    default: throw new DesktopRrhhRejected("Acción de Recursos Humanos no compatible.");
  }
}
